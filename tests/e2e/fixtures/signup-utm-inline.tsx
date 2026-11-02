import { createRoot } from "react-dom/client";
import { SignupForm } from "../../../src/components/features/auth/signup-form";
Object.assign(globalThis,{__mountSignup(){const root=document.getElementById("signup");if(!root)throw Error("missing fixture");createRoot(root).render(<SignupForm termsVersion="v1" privacyVersion="v2" />);}});
