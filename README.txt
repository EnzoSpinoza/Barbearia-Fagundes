BARBEARIA — VERSÃO CORRIGIDA + SUPABASE

Você já executou o SQL no Supabase, então não execute supabase.sql novamente agora.

Em public/config.js:
- SUPABASE_URL = Project URL
- SUPABASE_ANON_KEY = Publishable Key
- WHATSAPP_NUMBER = número da barbearia, somente números com 55

A versão corrigida:
- mostra o erro real do Supabase ao falhar;
- diferencia horário ocupado de outros erros;
- consulta business_hours para montar os horários por dia;
- salva clientes;
- possui login do barbeiro;
- possui Agenda, Clientes, Horários, Serviços/Preços e Fotos;
- usa Supabase Auth + RLS.

Nunca coloque secret key, service_role ou sb_secret no config.js.

CONTABILIDADE
Para ativar a aba Financeiro em um banco que já estava configurado, execute apenas
o arquivo finance.sql no Supabase SQL Editor, uma única vez.
Depois da atualização que integra Agenda e Financeiro, execute finance.sql novamente:
o arquivo é seguro e adiciona apenas a proteção contra lançamentos duplicados.

RESUMO MENSAL
O painel financeiro mostra apenas os cortes, entradas, saídas e saldo do mês atual.
Quando um novo mês começa, esses indicadores voltam a zero automaticamente, mas o
histórico antigo não é apagado. A opção "Limpeza temporária" apaga todos os
agendamentos e lançamentos financeiros após uma confirmação digitada.

PRIMEIRO ACESSO DO BARBEIRO
1. No Supabase, abra Authentication > Users e clique em Add user > Create new user.
2. Informe o e-mail e uma senha temporária do barbeiro e confirme o e-mail.
3. Entre pelo painel do site e abra Minha conta para trocar o e-mail e a senha.

Não coloque e-mail ou senha administrativa dentro do config.js ou do index.html.
