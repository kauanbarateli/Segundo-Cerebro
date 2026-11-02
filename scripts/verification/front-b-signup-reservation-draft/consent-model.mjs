/** Pure model only. No database, UTM content, identity verification or integration. */
const version = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 100;

export function reserveConsent({terms, privacy, acceptedLegal, originPending, acceptedOrigin, originVersion}) {
  if (!version(terms) || !version(privacy) || acceptedLegal !== true || typeof originPending !== 'boolean' || typeof acceptedOrigin !== 'boolean') throw Error('invalid consent');
  const originAccepted = originPending && acceptedOrigin;
  if (originAccepted && !version(originVersion)) throw Error('invalid origin version');
  const snapshot = Object.freeze({terms, privacy, originAccepted, originVersion: originAccepted ? originVersion : null});
  return Object.freeze({snapshot, originWithdrawn:false, discardPendingOrigin:originPending && !originAccepted});
}

export function withdrawOrigin(state) {
  return Object.freeze({...state, originWithdrawn:true, discardPendingOrigin:true});
}

export function resumeConsent(state, current) {
  if (state.snapshot.terms !== current.terms || state.snapshot.privacy !== current.privacy) return {status:'legal-changed'};
  const acceptOrigin = state.snapshot.originAccepted && !state.originWithdrawn;
  if (acceptOrigin && state.snapshot.originVersion !== current.originVersion) return {status:'origin-version-changed'};
  return {status:'ready', acceptOrigin, originVersion:acceptOrigin ? state.snapshot.originVersion : null};
}
