// Solo se invoca desde el comando local privilegiado, nunca desde una ruta HTTP.
export async function changeAdminRole(auth,uid,grant){
 if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||typeof grant!=='boolean')throw new Error('Argumentos no válidos.');
 const account=await auth.getUser(uid);
 if(grant&&account.disabled)throw new Error('La cuenta está deshabilitada.');
 const claims={...(account.customClaims||{})};
 if(grant)claims.admin=true;else delete claims.admin;
 await auth.setCustomUserClaims(uid,claims);
 if(!grant)await auth.revokeRefreshTokens(uid);
}
