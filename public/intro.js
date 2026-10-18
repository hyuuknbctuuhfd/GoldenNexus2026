const savedLang = localStorage.getItem('goldnexus_lang');
if (savedLang) {
    document.getElementById('intro-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    currentLang = savedLang;
    applyTranslations();
} else {
    document.getElementById('intro-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
}

function selectLanguage(lang) {
    localStorage.setItem('goldnexus_lang', lang);
    currentLang = lang;
    const tg = window.Telegram.WebApp;
    if (tg.initDataUnsafe?.user?.id) {
        fetch('/api/set-language', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: tg.initDataUnsafe.user.id, lang })
        });
    }
    document.getElementById('intro-screen').style.animation = 'fadeOut 0.5s ease forwards';
    setTimeout(() => {
        document.getElementById('intro-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        document.getElementById('main-app').style.animation = 'slideUp 0.5s ease';
        applyTranslations();
        loadUserData();
    }, 500);
}

function showLanguageSelector() {
    const lang = prompt('Idioma / Language / Язык:\n1. Español\n2. English\n3. Русский');
    if (lang === '1') selectLanguage('es');
    else if (lang === '2') selectLanguage('en');
    else if (lang === '3') selectLanguage('ru');
                                          }
