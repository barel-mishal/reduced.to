import { component$, createContextId, Slot, useContextProvider } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import jwt_decode from 'jwt-decode';
import { ACCESS_COOKIE_NAME, refreshTokens, REFRESH_COOKIE_NAME, setTokensAsCookies } from '../shared/auth.service';
import { Navbar } from '../components/navbar/navbar';
import { VerifyAlert } from '../components/verify-alert/verify-alert';
import { ACCEPT_COOKIES_COOKIE_NAME, UseCookiesAlert } from '../components/use-cookies-alert/use-cookies-alert';
import { ExtendSesstion, useAuthSession, UserCtx } from './plugin@auth';

export const useGetCurrentUser = routeLoader$<UserCtx | null>(async ({ cookie, sharedMap }) => {
  const sessionAuth: ExtendSesstion = sharedMap.get("session");
  
  if (sessionAuth && sessionAuth.accessToken) {
    const expires = sessionAuth.expires;
    const expiryDate = new Date(expires);
    const currentDate = new Date();
    if (currentDate > expiryDate) {
      const { accessToken, refreshToken } = await refreshTokens(sessionAuth.refreshToken);
      setTokensAsCookies(accessToken, refreshToken, cookie);
      return jwt_decode(accessToken);
    } else {
      return jwt_decode(sessionAuth.accessToken);
    }
  }

  const originalAuth = {
    accessCookie: cookie.get(ACCESS_COOKIE_NAME)?.value,
    refreshCookie: cookie.get(REFRESH_COOKIE_NAME)?.value,
  };

  if (originalAuth.accessCookie) {
    return jwt_decode(originalAuth.accessCookie);
  } else if (originalAuth.refreshCookie) {
    const { accessToken, refreshToken } = await refreshTokens(originalAuth.refreshCookie);
    setTokensAsCookies(accessToken, refreshToken, cookie);
    return jwt_decode(accessToken);
  } 

  return null;
});

export const useAcceptCookies = routeLoader$(({ cookie }) => cookie.get(ACCEPT_COOKIES_COOKIE_NAME)?.value);

export const useUserAuthStatus = () => {
  const userCtx = useGetCurrentUser().value;
  const acceptedCookies = useAcceptCookies().value;
  const userSession = useAuthSession().value as ExtendSesstion;
  const verifiedAndLoginByEmail = userCtx?.email !== undefined && userCtx.verified === true;
  const verifiedAndLoginByProvider = userSession?.expires !== undefined && new Date(userSession?.expires).getTime() > Date.now();
  return {
    isLogIn: userCtx?.id !== undefined,
    verifiedAndLogin: verifiedAndLoginByEmail || verifiedAndLoginByProvider,
    isProvider: verifiedAndLoginByProvider,
    isNotAcceptedCookies: acceptedCookies !== 'true',
    user: {
      name: userCtx?.name,
      email: userCtx?.email,
      role: userCtx?.role,
    }
  }
}

export type TypeUserAuthStatus = ReturnType<typeof useUserAuthStatus>;
export const UserAuthStatusContext = createContextId<TypeUserAuthStatus>('UserAuthStatusContext');

export default component$(() => {
  const session = useUserAuthStatus();
  useContextProvider(UserAuthStatusContext, session);
  return (
    <>
      <Navbar />
      {session.verifiedAndLogin ? <></> : <VerifyAlert />}
      <main>
        <section>
          <Slot />
        </section>
      </main>
      <UseCookiesAlert visible={session.isNotAcceptedCookies} />
    </>
  );
});

