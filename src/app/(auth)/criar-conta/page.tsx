import {redirect} from 'next/navigation';
import {signupOriginQuery} from '@/core/acquisition/signup-origin-transport';

/** Keep the public landing contract while the admission flow owns /cadastro. */
export default async function SignupEntry({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 redirect(`/cadastro${signupOriginQuery(await searchParams)}`);
}
