import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {changeAdminRole} from '../src/admin-roles.js';
const args=process.argv.slice(2),uidAt=args.indexOf('--uid'),uid=uidAt>=0?args[uidAt+1]:null,grant=args.includes('--grant'),revoke=args.includes('--revoke');
if(!uid||!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||grant===revoke||args.length!==3){console.error('Uso: node scripts/admin-role.mjs --uid UID --grant (o --revoke)');process.exitCode=1;}
else try{
 if(process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Retira la configuración de emulador antes de cambiar permisos del proyecto real.');
 const app=initializeApp({projectId:'checkia-project',credential:applicationDefault()}),auth=getAuth(app);
 await changeAdminRole(auth,uid,grant);
 console.log(grant?'Permiso de administrador asignado. Cierra sesión y vuelve a entrar en CHECKIA.':'Permiso retirado y sesiones revocadas.');
}catch(e){console.error('No se pudo cambiar el permiso. Comprueba el UID y que tu cuenta gcloud tenga permisos de Firebase Authentication. Código: '+(e.code||'configuracion'));process.exitCode=1;}
