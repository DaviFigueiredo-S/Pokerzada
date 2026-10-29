// Duas etapas recuperáveis: bloquear/anonimizar no banco, remover no Auth, confirmar.
export async function deleteAccount({api, token, userId}) {
  if(!token)throw Error('Entre na sua conta.');
  if(typeof userId!=='string'||!/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(userId))throw Error('Conta inválida.');
  const actor=await api('/auth/v1/user',{token});
  const args={actor_id:actor.id,target_id:userId};
  const job=await api('/rest/v1/rpc/poker_delete_account_prepare',{admin:true,body:args});
  if(job.done)return {ok:true,deleted:true};
  try {
    await api('/auth/v1/admin/users/'+userId,{admin:true,method:'DELETE'});
  } catch(e) {
    if(e.status!==404)throw Error('Exclusão pendente: o acesso já foi bloqueado, mas a remoção da autenticação não foi confirmada. Use “Concluir exclusão” para tentar novamente.');
  }
  await api('/rest/v1/rpc/poker_delete_account_finish',{admin:true,body:args});
  return {ok:true,deleted:true};
}
