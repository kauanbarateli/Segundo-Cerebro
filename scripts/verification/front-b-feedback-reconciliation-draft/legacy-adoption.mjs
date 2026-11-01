/** Guarded source transformation for synthetic review; never executes SQL. */
import {createHash} from 'node:crypto';
const BASE='77ee4ababfe9ef8259c3a6cdbb1adb59aa2bdd52f617b842fa6be46512d63d43';
const fail=()=>{throw Error('LEGACY_ADOPTION_REFUSED');};
const change=(s,a,b)=>{if(s.split(a).length!==2)fail();return s.replace(a,()=>b);};
export function withLegacyAdoption(bytes){
 if(!Buffer.isBuffer(bytes)||createHash('sha256').update(bytes).digest('hex')!==BASE)fail();
 let sql=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 const oldSubmit=` ELSE\n  INSERT INTO app_private.feedback_requests(user_id,client_id,category,message) VALUES(p_user,p_client,p_category,pg_catalog.btrim(p_message)) RETURNING * INTO v_row;\n  PERFORM app_private.append_event(p_user,'feedback_request',v_row.id,'created','web',NULL,\n   pg_catalog.jsonb_build_object('id',v_row.id,'category',v_row.category,'status','received'));\n  INSERT INTO app_private.feedback_barriers_draft(user_id,client_id,phase,feedback_id) VALUES(p_user,p_client,'submitted',v_row.id);\n END IF;`;
 const newSubmit=` ELSE\n  -- A committed legacy row may be adopted only under the same keyed lock.\n  SELECT * INTO v_row FROM app_private.feedback_requests WHERE user_id=p_user AND client_id=p_client FOR UPDATE;\n  IF FOUND THEN\n   IF v_row.category IS DISTINCT FROM p_category OR v_row.message IS DISTINCT FROM pg_catalog.btrim(p_message) THEN RAISE EXCEPTION 'Conflicting request.' USING ERRCODE='23505'; END IF;\n  ELSE\n   INSERT INTO app_private.feedback_requests(user_id,client_id,category,message) VALUES(p_user,p_client,p_category,pg_catalog.btrim(p_message)) RETURNING * INTO v_row;\n   PERFORM app_private.append_event(p_user,'feedback_request',v_row.id,'created','web',NULL,\n    pg_catalog.jsonb_build_object('id',v_row.id,'category',v_row.category,'status','received'));\n  END IF;\n  INSERT INTO app_private.feedback_barriers_draft(user_id,client_id,phase,feedback_id) VALUES(p_user,p_client,'submitted',v_row.id);\n END IF;`;
 sql=change(sql,oldSubmit,newSubmit);
 const cancelHeader=`CREATE FUNCTION app_private.draft_feedback_cancel(p_user uuid,p_session uuid,p_client uuid) RETURNS jsonb\nLANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$\nDECLARE v_barrier app_private.feedback_barriers_draft;`;
 sql=change(sql,cancelHeader,cancelHeader+' v_legacy_id uuid;');
 const oldCancel=`  -- Legacy feedback without a barrier cannot be treated as cancelled. This\n  -- check alone cannot fence an old writer concurrently creating that row.\n  IF EXISTS(SELECT 1 FROM app_private.feedback_requests WHERE user_id=p_user AND client_id=p_client) THEN\n   RAISE EXCEPTION 'Unavailable.' USING ERRCODE='42501';\n  END IF;`;
 const newCancel=`  -- Only a committed same-owner legacy row proves an earlier submission.\n  SELECT id INTO v_legacy_id FROM app_private.feedback_requests WHERE user_id=p_user AND client_id=p_client FOR UPDATE;\n  IF FOUND THEN\n   INSERT INTO app_private.feedback_barriers_draft(user_id,client_id,phase,feedback_id) VALUES(p_user,p_client,'submitted',v_legacy_id);\n   RETURN pg_catalog.jsonb_build_object('status','submitted','clientId',p_client,'feedbackId',v_legacy_id);\n  END IF;`;
 sql=change(sql,oldCancel,newCancel);
 const statusHeader=`CREATE FUNCTION app_private.draft_feedback_status(p_user uuid,p_session uuid,p_client uuid) RETURNS jsonb\nLANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$\nDECLARE v_barrier app_private.feedback_barriers_draft;`;
 sql=change(sql,statusHeader,statusHeader+' v_legacy_id uuid;');
 const oldStatus=` SELECT * INTO v_barrier FROM app_private.feedback_barriers_draft WHERE user_id=p_user AND client_id=p_client;\n IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('status','unknown','clientId',p_client); END IF;`;
 const newStatus=` -- Even the status path locks before adopting a committed legacy row.\n PERFORM app_private.draft_feedback_lock(p_user,p_client);\n SELECT * INTO v_barrier FROM app_private.feedback_barriers_draft WHERE user_id=p_user AND client_id=p_client FOR UPDATE;\n IF NOT FOUND THEN\n  SELECT id INTO v_legacy_id FROM app_private.feedback_requests WHERE user_id=p_user AND client_id=p_client FOR UPDATE;\n  IF FOUND THEN\n   INSERT INTO app_private.feedback_barriers_draft(user_id,client_id,phase,feedback_id) VALUES(p_user,p_client,'submitted',v_legacy_id);\n   RETURN pg_catalog.jsonb_build_object('status','submitted','clientId',p_client,'feedbackId',v_legacy_id);\n  END IF;\n  RETURN pg_catalog.jsonb_build_object('status','unknown','clientId',p_client);\n END IF;`;
 sql=change(sql,oldStatus,newStatus);
 const oldCancelled="IF v_barrier.phase='cancelled' THEN RETURN pg_catalog.jsonb_build_object('status','cancelled','clientId',p_client); END IF;";
 const guardedCancelled="IF v_barrier.phase='cancelled' THEN\n   IF EXISTS(SELECT 1 FROM app_private.feedback_requests WHERE user_id=p_user AND client_id=p_client) THEN RAISE EXCEPTION 'Unavailable.' USING ERRCODE='55000'; END IF;\n   RETURN pg_catalog.jsonb_build_object('status','cancelled','clientId',p_client);\n  END IF;";
 if(sql.split(oldCancelled).length!==4)fail();sql=sql.replaceAll(oldCancelled,guardedCancelled);
 // A submitted barrier pointing at a missing row is persisted-state inconsistency, not failed authorization.
 const orphanSubmit="IF NOT FOUND THEN RAISE EXCEPTION 'Unavailable.' USING ERRCODE='42501'; END IF;";
 sql=change(sql,orphanSubmit,orphanSubmit.replace("'42501'","'55000'"));
 const orphanRead="IF NOT EXISTS(SELECT 1 FROM app_private.feedback_requests WHERE id=v_barrier.feedback_id AND user_id=p_user AND client_id=p_client) THEN RAISE EXCEPTION 'Unavailable.' USING ERRCODE='42501'; END IF;";
 if(sql.split(orphanRead).length!==3)fail();sql=sql.replaceAll(orphanRead,orphanRead.replace("'42501'","'55000'"));
 if(sql.split("UNREVIEWED SCRATCH SQL: DO NOT APPLY").length!==2||!sql.endsWith('COMMIT;\n'))fail();
 return Buffer.from(sql);
}
