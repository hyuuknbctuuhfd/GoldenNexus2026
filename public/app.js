const tg = window.Telegram.WebApp;
tg.expand();
const userId = tg.initDataUnsafe?.user?.id;

const ROBOT_ICON = "https://i.ibb.co/S46bW8MD/Imagen-generada-con-Canva-IA-17-oct-2026-8-38-40-p-m.jpg";
const MEGAFONO_ICON = "https://i.ibb.co/Q30wNS0x/Imagen-generada-con-Canva-IA-17-oct-2026-8-39-25-p-m.jpg";

function switchTab(tabName, btnElement = null) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    else {
        const navBtn = document.querySelector(`.nav-item[onclick*="'${tabName}'"]`);
        if (navBtn) navBtn.classList.add('active');
    }
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = (progress * (end - start) + start).toFixed(2);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function loadUserData() {
    if (!userId) return;
    
    fetch(`/api/user/${userId}`).then(res => res.json()).then(data => {
        animateValue('balance', 0, data.balance, 1500);
    }).catch(err => console.log(err));
    
    fetch('/api/ranking').then(res => res.json()).then(data => {
        document.getElementById('ranking-list').innerHTML = data.map((u, i) => {
            let medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
            return `<div class="rank-item"><span>${medal} ${u.username}</span><span class="points">${u.referidos} refs</span></div>`;
        }).join('');
    }).catch(err => console.log(err));

    fetch(`/api/tasks/${userId}`).then(res => res.json()).then(data => {
        const container = document.getElementById('tasks-container');
        if (data.tasks && data.tasks.length > 0) {
            container.innerHTML = data.tasks.map(task => {
                const completed = data.completedIds.includes(task.id);
                const isBotTask = task.link.includes('bot?start=') || task.link.includes('Bot?start=') || task.link.includes('bot');
                const iconUrl = isBotTask ? ROBOT_ICON : MEGAFONO_ICON;
                
                let buttonHTML = '';
                if (completed) {
                    buttonHTML = `<button class="btn-claim" disabled style="opacity:0.5">✅ Hecho</button>`;
                } else if (isBotTask) {
                    buttonHTML = `
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            <button class="btn-claim" onclick="window.open('${task.link}', '_blank')" style="background: #0088cc; color: white; padding: 8px; font-size: 11px;">1. Ir al Bot</button>
                            <button class="btn-claim" style="background: #ffd700; padding: 8px; font-size: 11px;" onclick="claimBotTask(${task.id})">2. Reclamar</button>
                        </div>
                    `;
                } else {
                    buttonHTML = `<button class="btn-claim" onclick="openAndVerify('${task.link}', ${task.id})">Unirse</button>`;
                }

                return `
                    <div class="task-card">
                        <img src="${iconUrl}" class="task-icon-img" alt="Icon">
                        <div class="task-info">
                            <h3>${task.title}</h3>
                            <p class="reward">+${task.reward} USDT</p>
                        </div>
                        ${buttonHTML}
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = `<p style="text-align:center; color:#889988; margin-top:20px;">No hay tareas disponibles ahora.</p>`;
        }
    }).catch(err => console.log(err));
}

function openAndVerify(link, taskId) {
    window.open(link, '_blank');
    if (userId) {
        tg.sendData(JSON.stringify({ action: 'verify_task', taskId: taskId, userId: userId }));
    }
}

function claimBotTask(taskId) {
    if (!userId) return;
    if (confirm("¿Ya te registraste en el bot? Se te abonará la recompensa.")) {
        fetch('/api/claim-task', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, taskId })
        }).then(res => res.json()).then(data => {
            alert(data.message || data.error);
            if (data.success) loadUserData();
        });
    }
}

function shareReferral() {
    // ⚠️ IMPORTANTE: Cambia 'GoldNexusRewardsBot' por el nombre de usuario real de tu bot
    const link = `https://t.me/GoldNexusRewardsBot?start=${userId}`;
    navigator.clipboard.writeText(link).then(() => {
        alert('🔗 ¡Enlace copiado!\n' + link);
    }).catch(() => {
        alert('🔗 Tu enlace es:\n' + link);
    });
}

document.getElementById('checkin-btn').addEventListener('click', () => {
    if (!userId) return alert("Abre esto desde Telegram");
    fetch('/api/checkin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    }).then(res => res.json()).then(data => {
        alert(data.message || data.error);
        if (data.success) loadUserData();
    });
});

document.getElementById('withdraw-btn').addEventListener('click', () => {
    if (!userId) return alert("Abre esto desde Telegram");
    const wallet = prompt('Ingresa tu dirección de wallet BEP20:');
    if (!wallet) return;
    const amount = parseFloat(prompt('¿Cuánto deseas retirar? (Mínimo 10 USDT)'));
    if (!amount || amount < 10) return alert('Monto inválido, el mínimo es 10 USDT');

    fetch('/api/withdraw', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount, wallet })
    }).then(res => res.json()).then(data => alert(data.message || data.error));
});

loadUserData();
