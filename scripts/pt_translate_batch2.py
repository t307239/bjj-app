#!/usr/bin/env python3
"""
Batch 2 PT translation: profile, body, goal, chart, stats, home, insights,
insight, focus, competition, compGoal, rollAnalytics, streak, weeklyStrip,
matTime, records, skillMapPage, monthlyShare.

Reads /tmp/pt_missing_keys.json, filters for the target sections,
and writes translations to /tmp/pt_batch2.json.
"""

import json
import sys

SECTIONS = {
    "profile", "body", "goal", "chart", "stats", "home", "insights",
    "insight", "focus", "competition", "compGoal", "rollAnalytics",
    "streak", "weeklyStrip", "matTime", "records", "skillMapPage",
    "monthlyShare",
}

TRANSLATIONS: dict[str, str] = {
    # ── profile ──────────────────────────────────────────────────
    "profile.stripe": "Stripe",
    "profile.gymSubtext": "Usado para conectar você com parceiros de treino na mesma academia",
    "profile.bioPlaceholder": "Seus objetivos, posições favoritas, pensamentos sobre o treino...",
    "profile.saveFailed": "Falha ao salvar",
    "profile.futureDateError": "Não é possível definir uma data futura para o início no BJJ",
    "profile.authError": "Não foi possível obter informações de login. Tente novamente.",
    "profile.bjjHistory": "Praticando BJJ há {n} meses",
    "profile.stripeCount": "{n} stripe(s)",
    "profile.gymNotSet": "Academia / data de início não definidos",
    "profile.account": "Conta",
    "profile.manageSub": "Gerenciar Assinatura",
    "profile.manageSubDesc": "Cancele ou atualize seu plano Pro sem precisar ligar para ninguém.",
    "profile.deleting": "Excluindo...",
    "profile.appSettings": "Configurações do App",
    "profile.settingsSoon": "Mais configurações em breve.",
    "profile.emailChangeDesc": "Altere seu endereço de e-mail de login",
    "profile.emailChangeBtn": "Alterar e-mail",
    "profile.emailChangeLabel": "Digite seu novo endereço de e-mail. Um link de confirmação será enviado.",
    "profile.emailChangeSend": "Enviar confirmação",
    "profile.emailConfirmSent": "E-mail de confirmação enviado. Verifique sua caixa de entrada para concluir a alteração.",
    "profile.emailInvalid": "Por favor, insira um endereço de e-mail válido.",
    "profile.nameChangeDesc": "Altere seu nome de exibição",
    "profile.nameChangeBtn": "Alterar nome",
    "profile.nameChangeLabel": "Digite seu novo nome de exibição",
    "profile.nameChangeSave": "Salvar",
    "profile.nameChanged": "Nome de exibição atualizado.",
    "profile.helpLink": "Ajuda e FAQ",
    "profile.contactSupport": "Contato com Suporte",
    "profile.termsLink": "Termos",
    "profile.privacyLink": "Privacidade",
    "profile.deletingLabel": "Excluindo…",
    "profile.saveFailedUnknown": "Erro desconhecido",
    "profile.ariaLeaveGymCancel": "Cancelar saída da academia",
    "profile.ariaLeaveGymConfirm": "Confirmar saída da academia",
    "profile.ariaLeaveGym": "Sair da academia",
    "profile.ariaManageSub": "Gerenciar assinatura no Portal do Cliente Stripe",
    "profile.tabs.stats": "Estatísticas",
    "profile.tabs.profile": "Perfil",
    "profile.tabs.body": "Corpo",
    "profile.tabs.settings": "Configurações",
    "profile.ariaDisableSharing": "Desativar compartilhamento de dados",
    "profile.ariaEnableSharing": "Ativar compartilhamento de dados",
    "profile.csvHeaderDate": "Data",
    "profile.csvHeaderType": "Tipo",
    "profile.csvHeaderDuration": "Duração(min)",
    "profile.csvHeaderNotes": "Notas",
    "profile.csvHeaderCreatedAt": "Criado em",
    "profile.pushNotifications": "Notificações Push",
    "profile.pushNotificationsDesc": "Receba lembretes de sequência e atualizações da academia mesmo com o app fechado.",
    "profile.pushEnable": "Ativar notificações",
    "profile.pushDisable": "Desativar notificações",
    "profile.pushEnabled": "✅ Notificações ativadas",
    "profile.pushBlocked": "Notificações bloqueadas pelo navegador. Ative nas configurações do dispositivo.",
    "profile.pushNotSupported": "Notificações push não são suportadas neste navegador/dispositivo.",
    "profile.pushEnabling": "Ativando…",
    "profile.pushDisabling": "Desativando…",
    "profile.ariaPushToggle": "Alternar notificações push",
    "profile.gymLeadTitle": "Gerencia uma academia?",
    "profile.gymLeadDesc": "Crie a página da sua academia, obtenha um código QR de convite e acompanhe o progresso dos seus alunos.",
    "profile.gymLeadCta": "Configurar sua academia →",
    "profile.referralTitle": "Convide Amigos",
    "profile.referralDesc": "Compartilhe seu link de indicação com parceiros de treino. Quando eles se cadastrarem, vocês ficarão conectados.",
    "profile.referralLink": "Seu Link de Indicação",
    "profile.referralCopied": "Copiado!",
    "profile.referralCopy": "Copiar",
    "profile.referralCount": "{n} amigos convidados",
    "profile.referralCountZero": "Nenhuma indicação ainda — compartilhe seu link!",
    "profile.referralShare": "Treine BJJ comigo! Registre seus treinos e construa seu mapa de habilidades de graça:",
    "profile.referralShareBtn": "Compartilhar Link de Convite",
    "profile.referralMilestones": "Medalhas de Indicação",
    "profile.referralFriends": "amigos",
    "profile.referralUnlocked": "Desbloqueado!",
    "profile.referralProgress": "{n}/{goal} para a próxima medalha",
    "profile.referralAllUnlocked": "🏆 Todas as medalhas de indicação desbloqueadas — você é uma lenda!",

    # ── body ─────────────────────────────────────────────────────
    "body.title": "Gestão Corporal",
    "body.quickLog": "Registro Rápido de Peso",
    "body.weightKg": "Peso (kg)",
    "body.logWeight": "Registrar Peso",
    "body.saving": "Salvando...",
    "body.saved": "Registrado ✓",
    "body.saveError": "Falha ao salvar. Tente novamente.",
    "body.offlineError": "Você está offline — as alterações não serão salvas.",
    "body.note": "Nota (opcional)",
    "body.bodyMap": "Mapa Corporal",
    "body.tapHint": "Toque em uma parte do corpo para alternar: OK → Dolorido → Lesionado",
    "body.paywallTitle": "Acompanhe seu peso e condição corporal com o Pro 💪",
    "body.paywallDesc": "Gráfico de tendência de peso e mapa de lesões são recursos Pro.",
    "body.paywallCta": "Upgrade para Pro",
    "body.status.ok": "OK",
    "body.status.sore": "Dolorido",
    "body.status.injured": "Lesionado",
    "body.status.untouched": "Não definido",
    "body.status.tapToMark": "Toque para marcar dolorido/lesionado",
    "body.injuryAlert.recurring": "Recorrente",

    # ── goal ─────────────────────────────────────────────────────
    "goal.title": "🎯 Metas de Treino",
    "goal.done": "Feito!",
    "goal.cancel": "Cancelar",
    "goal.set": "Definir",
    "goal.edit": "Editar",
    "goal.plusSet": "+ Definir",
    "goal.noGoal": "Nenhuma meta definida — toque para definir",
    "goal.noGoalParen": "Nenhuma meta definida (toque para definir)",
    "goal.setAGoal": "Definir uma meta",
    "goal.weekly": "Meta semanal",
    "goal.monthly": "Meta mensal",
    "goal.technique": "🥋 Meta de técnicas",
    "goal.thisWeek": "Esta semana",
    "goal.lastWeek": "Semana passada",
    "goal.weeksAgo": "{n} semanas atrás",
    "goal.setWeeklyHeader": "Definir meta semanal",
    "goal.setMonthlyHeader": "Definir meta mensal",
    "goal.setTechniqueHeader": "Definir meta de técnicas",
    "goal.sessionsPicker": "sessões",
    "goal.currentDone": "Atual: {n} sessões realizadas",
    "goal.goalSaved": "Meta definida!",
    "goal.goalFailed": "Falha ao salvar",
    "goal.allAchieved": "Todas as metas alcançadas!",
    "goal.monthsInRow": "🔥 {n} meses consecutivos! O caminho para a faixa preta está se abrindo",
    "goal.monthsHabit": "✨ {n} meses alcançados! Criando um hábito",
    "goal.keepGoing": "👍 Incrível! Continue assim!",
    "goal.weeksInRow": "🔥 {n} semanas consecutivas",
    "goal.compactWeekly": "Semanal {a}/{b}",
    "goal.compactMonthly": "Mensal {a}/{b}",
    "goal.onTrack": "No ritmo 🎯",
    "goal.onPaceFor": "No ritmo para {n}",
    "goal.onTrackSuffix": " — No ritmo",
    "goal.pickUpPace": " ⚠ Acelere o ritmo",
    "goal.extraWeek": "🔥 Meta +{n} extra! Melhor ritmo da semana",
    "goal.extraMonth": "🔥 Meta +{n} extra!",
    "goal.weeklyClear": "🎯 Meta semanal atingida! Continue treinando até o fim de semana",
    "goal.monthlyAchieved": "🎯 Meta mensal atingida! O resto do mês é bônus",
    "goal.consecutiveMonths": "✨ {n} meses alcançados!",
    "goal.zeroDaysLeft": "0 dias restantes · mais {n}",
    "goal.moreNeeded": "Faltam {needed} · {days} dias restantes",
    "goal.past6Months": "Últimos 6 meses",
    "goal.monthsAchieved": "{n} / 6 meses alcançados",

    # ── chart ────────────────────────────────────────────────────
    "chart.monthlyGraph": "Gráfico Mensal de Treinos",
    "chart.pastMonths": "Últimos {n} meses",
    "chart.months": " meses",
    "chart.count": "Quantidade",
    "chart.duration": "Duração",
    "chart.minutes": "m",
    "chart.proOnly": "Visualização de 12 meses é exclusiva do plano Pro",
    "chart.upgradeToProBtn": "Upgrade para Pro",
    "chart.average": "Média",
    "chart.month": "mês",
    "chart.trainingLog": " registro de treinos",
    "chart.close": "Fechar",
    "chart.noRecords": "Sem registros",
    "chart.activity": "Atividade de Treino",
    "chart.monthly": "Mensal",
    "chart.less": "Menos",
    "chart.more": "Mais",
    "chart.past6Months": "Últimos 6 meses",
    "chart.typeDistribution": "Tipos de Treino",
    "chart.allTime": "Todo o Período",
    "chart.thisWeek": "Esta Semana",
    "chart.thisMonth": "Este Mês",
    "chart.timesUnit": "",
    "chart.sessions": "sessões",
    "chart.totalTime": "tempo total",
    "chart.noSessionsThisWeek": "Nenhuma sessão esta semana",
    "chart.noSessionsThisMonth": "Nenhuma sessão este mês",
    "chart.noSessionsYet": "Nenhuma sessão registrada",
    "chart.logToFillChart": "Registre sua primeira sessão para preencher este gráfico!",
    "chart.monthlyTrendSubtitle": "Tendência mensal (últimos 6 meses)",
    "chart.clickForTrend": "Clique para ver a tendência mensal",
    "chart.sessionsFmt": "{n} sessões",
    "chart.totalLabel": "Total: ",
    "chart.avgLabel": "Média: ",
    "chart.emptyHeading": "Registre seu primeiro rola para desbloquear insights",
    "chart.emptySubtitle": "Seu mapa de atividades aparecerá aqui",
    "chart.emptyButton": "Registrar um Rola",

    # ── stats ────────────────────────────────────────────────────
    "stats.personalBests": "Recordes Pessoais",
    "stats.emptyBests": "Registre sua primeira sessão para ver suas estatísticas aqui.",
    "stats.totalSessions": "Total de Sessões",
    "stats.totalMinutes": "Tempo Total",
    "stats.longestStreak": "Maior Sequência",
    "stats.bestMonth": "Melhor Mês",
    "stats.avgPerSession": "Média por Sessão",
    "stats.monthlyAvg": "Média Mensal",
    "stats.bestWeek": "Melhor Semana",
    "stats.dayStreak": " dias consecutivos",
    "stats.share": "Compartilhar",
    "stats.shared": "Compartilhado!",
    "stats.longestSession": "Sessão Mais Longa",
    "stats.bestDayLabel": "Dia mais treinado",
    "stats.dayOfWeek": " dia",
    "stats.last6MonthsAvg": "Duração média (últimos 6 meses)",
    "stats.lastMonthCompare": "vs mês passado",
    "stats.samePaceLast": "Mesmo ritmo do mês passado",
    "stats.BJJRecordTitle": "Registro de Treinos BJJ",
    "stats.BJJHashtag": "BJJ",
    "stats.daysUnit": " dias",

    # ── home ─────────────────────────────────────────────────────
    "home.weekSessions": "Esta semana: {n}",
    "home.monthSessions": "Este mês: {n}",
    "home.streakDays": "🔥{n}d",
    "home.streakZero": "🔥0d",
    "home.recentTitle": "Treinos Recentes",
    "home.viewAllRecords": "Ver todos os registros",
    "home.emptyTitle": "Nenhum registro de treino ainda",
    "home.emptyDesc": "Registre sua primeira sessão para começar",
    "home.emptyCtaRecord": "Registrar uma sessão",
    "home.proInsightTeaser": "📈 Análise de tendência de treino",
    "home.proInsightDesc": "Veja análises detalhadas de treino com o Pro →",
    "home.heatmapTitle": "Atividade de Treino",
    "home.heatmapDays": "{n} dias treinados",
    "home.heatmapLess": "Menos",
    "home.heatmapMore": "Mais",
    "home.emptyMotivationTitle": "Sua jornada começa aqui",
    "home.emptyMotivationDesc": "Todo faixa preta já foi faixa branca. Registre sua primeira sessão e comece a acompanhar seu progresso.",
    "home.emptyTip": "Dica: Leva menos de 10 segundos para registrar uma sessão",
    "home.weekdaySun": "Dom",
    "home.weekdayMon": "Seg",
    "home.weekdayTue": "Ter",
    "home.weekdayWed": "Qua",
    "home.weekdayThu": "Qui",
    "home.weekdayFri": "Sex",
    "home.weekdaySat": "Sáb",
    "home.totalSessions": "{n} no total",
    "home.bjjDuration": "Treinando há {duration}",
    "home.emptyWeekStat": "Esta semana: {n} sessões. Comece a primeira!",

    # ── insights ─────────────────────────────────────────────────
    "insights.title": "Insights de Treino",
    "insights.pace": "Ritmo",
    "insights.bestDayOfWeek": "Melhor dia da semana",
    "insights.dayOfWeek": " dia",
    "insights.thisMonth": "Este Mês",
    "insights.achieved": " alcançado",
    "insights.record": "Recorde",
    "insights.consistency": "Consistência",
    "insights.lastMonthComparePlus": "Mês passado +{n} de ritmo 🏃",
    "insights.lastMonthCompareMinus": "Mês passado {n} de ritmo",
    "insights.lastMonthCompareSame": "Mesmo ritmo do mês passado ➡️",
    "insights.thisMonthRecording": "Registrando {n} este mês ✨",
    "insights.longestStreak": "Maior sequência: {n} dias",
    "insights.consistencyRate": "{emoji} Taxa de prática {rate}%",
    "insights.wikiConceptualLearning": "Leia: Aprendizado Conceitual no BJJ",
    "insights.wikiFlowState": "Leia: Treino em Estado de Flow",
    "insights.wikiDrilling": "Leia: Metodologia de Drilling",
    "insights.dismiss": "Dispensar",

    # ── insight ──────────────────────────────────────────────────
    "insight.milestone": "🎉 {n} sessões no total! Dedicação incrível.",
    "insight.weekFive": "🔥 5+ sessões esta semana — intensidade incrível!",
    "insight.weekThree": "💪 {n} sessões esta semana — ótima consistência!",
    "insight.variety": "🎯 Boa variedade no seu mix de treinos!",
    "insight.longSession": "⏱️ Sessão longa! Ótimo trabalho de resistência.",

    # ── focus ────────────────────────────────────────────────────
    "focus.title": "Foco em Técnicas",
    "focus.manage": "Editar →",
    "focus.mastery0": "Aprendendo",
    "focus.mastery1": "Drillando",
    "focus.mastery2": "Sparring",
    "focus.mastery3": "Dominada",
    "focus.more": "+{n} mais",
    "focus.weekCount": "Praticada {n} vez(es) esta semana",
    "focus.weekNone": "Pratique sua técnica de foco esta semana!",
    "focus.emptyTitle": "Fixe técnicas para focar",
    "focus.emptyHint": "Vá em Técnicas → toque no ícone de fixar",

    # ── competition ──────────────────────────────────────────────
    "competition.giNogiSplit": "Divisão Gi / No-Gi",
    "competition.upgradeAnalytics": "Desbloqueie Análises de Lutas",
    "competition.viewAll": "Ver Todas as Lutas",
    "competition.hideAll": "Mostrar Recentes",
    "competition.matchHistory": "Histórico de Lutas",
    "competition.eventLabel": "Evento",

    # ── compGoal (no keys found in source, but included for completeness) ──

    # ── rollAnalytics (no keys found in source, but included for completeness) ──

    # ── streak ───────────────────────────────────────────────────
    "streak.protect": "🔥 Sequência de {n} dias em perigo! Registre o treino de hoje agora!",
    "streak.maintainDesc": "Registrar hoje manterá sua sequência",
    "streak.protect1": "⏰ Sequência de 1 dia — Não esqueça a sessão de hoje!",

    # ── weeklyStrip ──────────────────────────────────────────────
    "weeklyStrip.same": "= mesmo",
    "weeklyStrip.vsLastWeek": "vs semana passada",

    # ── matTime ──────────────────────────────────────────────────
    "matTime.title": "Tempo de Tatame",
    "matTime.hoursUnit": "horas no tatame",
    "matTime.reached": "Marco alcançado!",
    "matTime.nextMilestone": "Próximo: {target}h",
    "matTime.etaYears": "~{n} anos no ritmo atual",
    "matTime.etaMonths": "~{n} meses no ritmo atual",
    "matTime.etaWeeks": "~{n} semanas no ritmo atual",

    # ── records ──────────────────────────────────────────────────
    "records.tabLog": "Registro",
    "records.tabStats": "Estatísticas",
    "records.noStatsYet": "Registre seu primeiro treino para ver estatísticas",

    # ── skillMapPage ─────────────────────────────────────────────
    "skillMapPage.title": "Mapa de Habilidades",
    "skillMapPage.cardTitle": "Abrir Mapa de Habilidades",
    "skillMapPage.cardDesc": "Visualize sua árvore de técnicas — explore conexões de cada posição",

    # ── monthlyShare (no keys found in source, but included for completeness) ──
}


def main() -> None:
    with open("/tmp/pt_missing_keys.json", "r", encoding="utf-8") as f:
        missing: dict[str, str] = json.load(f)

    # Filter for target sections
    target_keys: dict[str, str] = {}
    for key in missing:
        section = key.split(".")[0]
        if section in SECTIONS:
            target_keys[key] = missing[key]

    # Build output using hardcoded translations
    output: dict[str, str] = {}
    untranslated: list[str] = []

    for key in target_keys:
        if key in TRANSLATIONS:
            output[key] = TRANSLATIONS[key]
        else:
            untranslated.append(key)

    if untranslated:
        print(f"WARNING: {len(untranslated)} key(s) not translated:")
        for k in untranslated:
            print(f"  - {k}")
        sys.exit(1)

    with open("/tmp/pt_batch2.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Done: {len(output)} keys written to /tmp/pt_batch2.json")


if __name__ == "__main__":
    main()
