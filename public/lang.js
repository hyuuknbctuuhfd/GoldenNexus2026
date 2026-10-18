const translations = {
    es: { balance: "Saldo Total", earn_more: "Ganar Más", withdraw: "Retirar", ranking: "Ranking Global", tasks: "Tareas de Hoy", checkin: "Check-in Diario", claim: "Reclamar", invite: "Invitar Amigos", home_btn: "Inicio", tasks_btn: "Tareas", ranking_btn: "Ranking", invite_btn: "Amigos" },
    en: { balance: "Total Balance", earn_more: "Earn More", withdraw: "Withdraw", ranking: "Global Ranking", tasks: "Today's Tasks", checkin: "Daily Check-in", claim: "Claim", invite: "Invite Friends", home_btn: "Home", tasks_btn: "Tasks", ranking_btn: "Ranking", invite_btn: "Friends" },
    ru: { balance: "Общий баланс", earn_more: "Заработать", withdraw: "Вывести", ranking: "Рейтинг", tasks: "Задачи", checkin: "Ежедневная отметка", claim: "Получить", invite: "Пригласить друзей", home_btn: "Главная", tasks_btn: "Задачи", ranking_btn: "Рейтинг", invite_btn: "Друзья" }
};
let currentLang = localStorage.getItem('goldnexus_lang') || 'es';
function applyTranslations() {
    const t = translations[currentLang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
}
