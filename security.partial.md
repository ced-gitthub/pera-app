PASS [email confirmation pages + password rules] /verify without an address offers a "send a new link" form
PASS [email confirmation pages + password rules] /verify?email= shows the address with a Resend button
PASS [email confirmation pages + password rules] /verify escapes hostile input (no script, no injected elements)
PASS [email confirmation pages + password rules] resend for an unknown address gives a generic answer (no account enumeration)
PASS [email confirmation pages + password rules] /verify rejects a malformed address with a plain message
PASS [email confirmation pages + password rules] a bad confirmation link lands on /verify with guidance, not an error page
PASS [email confirmation pages + password rules] a bad reset link lands on /forgot
PASS [email confirmation pages + password rules] open redirect through ?next= is ignored
PASS [email confirmation pages + password rules] an unsupported email-link type is refused safely
PASS [email confirmation pages + password rules] register form asks for 8+ characters
PASS [email confirmation pages + password rules] server rejects a 7-character password even when the browser check is bypassed
PASS [email confirmation pages + password rules] server rejects a single repeated character
PASS [email confirmation pages + password rules] server rejects a password found in a data breach (Have I Been Pwned, k-anonymity)
PASS [email confirmation pages + password rules] a strong unique password is accepted
PASS [security page: password + devices] sign up a fresh user and open /security
PASS [security page: password + devices] Settings links to Security and the Settings tab stays highlighted there
PASS [security page: password + devices] change password: wrong current password is refused
PASS [security page: password + devices] change password: mismatch is refused
PASS [security page: password + devices] change password: same password is refused
PASS [security page: password + devices] change password: breached password is refused
PASS [security page: password + devices] change password: 7 characters refused by the server
PASS [security page: password + devices] second device is logged in
PASS [security page: password + devices] change password: success keeps this device and logs out the other
PASS [security page: password + devices] change password: the new password works, the old one does not
PASS [security page: password + devices] "Log out other devices" ends other sessions and keeps this one
PASS [security page: password + devices] "Log out everywhere" ends this session too
PASS [two-step verification (authenticator app)] sign up; the setup shows a QR image and a typeable key
PASS [two-step verification (authenticator app)] setup: a wrong code is refused and 2FA stays off
PASS [two-step verification (authenticator app)] setup: the right code turns it on
PASS [two-step verification (authenticator app)] log out and in: the password alone only reaches the code screen
PASS [two-step verification (authenticator app)] while only the password is verified, every app page redirects to /2fa
PASS [two-step verification (authenticator app)] a wrong code is refused with a plain message
PASS [two-step verification (authenticator app)] the right code finishes log-in and lands on the dashboard
PASS [two-step verification (authenticator app)] /2fa is not reachable once fully signed in
PASS [two-step verification (authenticator app)] the security page shows 2FA as On and never shows the setup key again
PASS [two-step verification (authenticator app)] reset-password route is also gated by the code
PASS [two-step verification (authenticator app)] turning it off needs a valid code
PASS [two-step verification (authenticator app)] turning it off with the right code works
PASS [two-step verification (authenticator app)] after turning it off, log-in goes straight to the dashboard
PASS [two-step verification is enforced by the database (migration 0006)] mfa_ok() exists: callable by signed-in users, not by anonymous
PASS [two-step verification is enforced by the database (migration 0006)] without 2FA the user reads and writes normally
PASS [two-step verification is enforced by the database (migration 0006)] enrol a real authenticator factor and verify it (session becomes aal2)
PASS [two-step verification is enforced by the database (migration 0006)] aal2 session still reads its data
PASS [two-step verification is enforced by the database (migration 0006)] a fresh password-only (aal1) session is blocked from every table
PASS [two-step verification is enforced by the database (migration 0006)] aal1 cannot write either (insert is rejected)
PASS [two-step verification is enforced by the database (migration 0006)] aal1 gets nothing from the aggregate functions either
PASS [two-step verification is enforced by the database (migration 0006)] after the code is entered the same session reads everything again
PASS [two-step verification is enforced by the database (migration 0006)] another user without 2FA is unaffected
PASS [two-step verification is enforced by the database (migration 0006)] removing the factor restores plain password access
PASS [loading skeletons] every page streams its skeleton first, then the real content (full page load)
PASS [loading skeletons] the app shell (nav) is in the same first response as the skeleton
PASS [loading skeletons] navigating with slow data: the sidebar stays and a skeleton fills the page immediately
PASS [loading skeletons] the skeleton has an accessible name and the real page replaces it
PASS [loading skeletons] skeleton animation stops for people who prefer reduced motion
PASS [loading skeletons] mobile: tab bar stays while the skeleton shows, with no sideways scroll
PASS [loading skeletons] mobile 390px: /security fits the screen
PASS [loading skeletons] mobile 390px: /verify?email=someone@example.com fits the screen
PASS [loading skeletons] mobile 390px: /verify fits the screen
PASS [loading skeletons] mobile 390px: /login fits the screen
PASS [loading skeletons] mobile 390px: /register fits the screen
PASS [loading skeletons] mobile 390px: /forgot fits the screen
PASS [loading skeletons] mobile 390px: the 2FA setup (QR + key) fits the screen