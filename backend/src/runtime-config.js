export function runtimeConfig(env=process.env){
 const cloud=Boolean(env.K_SERVICE),port=Number(env.PORT||(cloud?8080:3001));
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT inválido');
 return {cloud,port,host:cloud?'0.0.0.0':'127.0.0.1',embeddingTimeoutMs:cloud?7000:20000,llmTimeoutMs:cloud?35000:45000};
}
