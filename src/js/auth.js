let _auth=null,_onLogin=null,_onLogout=null;
export function initAuth(a){_auth=a;}
export function onLogin(cb){_onLogin=cb;}
export function onLogout(cb){_onLogout=cb;}
export function startAuthListener(hideLoading) {
  if(!_auth){hideLoading?.();return;}
  _auth.onAuthStateChanged(user=>{
    hideLoading?.();
    if(user?.email) _onLogin?.(user);
    else if(user?.isAnonymous) _auth.signOut().then(()=>_onLogout?.());
    else _onLogout?.();
  });
}
export async function login(email,pass){
  if(!_auth)throw new Error("Firebase no disponible");
  return (await _auth.signInWithEmailAndPassword(email,pass)).user;
}
export async function register(email,pass){
  if(!_auth)throw new Error("Firebase no disponible");
  return (await _auth.createUserWithEmailAndPassword(email,pass)).user;
}
export async function logout(){if(_auth)await _auth.signOut();}
export async function changePassword(user,pwd){if(!user)throw new Error("Sin sesión");await user.updatePassword(pwd);}
export function getAuthErrorMsg(code){
  const m={"auth/user-not-found":"Usuario no encontrado.","auth/wrong-password":"Contraseña incorrecta.",
    "auth/email-already-in-use":"Ya existe una cuenta con ese email.","auth/invalid-email":"Email inválido.",
    "auth/weak-password":"Mínimo 6 caracteres.","auth/invalid-credential":"Email o contraseña incorrectos."};
  return m[code]||"Error de autenticación.";
}
