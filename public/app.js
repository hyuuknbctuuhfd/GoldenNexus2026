const tg = window.Telegram.WebApp;
tg.expand();
const userId = tg.initDataUnsafe?.user?.id;

// Enlaces a las imágenes en GitHub (asegúrate de que sean .png)
const ROBOT_ICON = "https://raw.githubusercontent.com/d7366957-collab/GoldNexus1/main/public/robot.png";
const MEGAFONO_ICON = "https://raw.githubusercontent.com/d7366957-collab/GoldNexus1/main/public/megafono.png";

// --- SISTEMA DE NOTIFICACIONES BONITAS ---
function showToast(message, isError = false) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.innerHTML = `<span>${isError ? '❌' : '✅'}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

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

function getReferralLink() {
    return `https://t.me/GoldNexusRewardsBot?start=${userId}`;
}

function loadUserData() {
    if (!userId) return;
    
    fetch(`/api/user/${userId}`).then(res => res.json()).then(data => {
        animateValue('balance', 0, data.balance, 1500);
        document.getElementById('withdraw-balance').innerText = data.balance.toFixed(2);
        
        // Lógica para calcular lo que recibe al retirar
        const receiveAmount = Math.max(0, data.balance); 
        document.getElementById('receive-amount').innerText = receiveAmount.toFixed(2) + ' USDT';

        document.getElementById('ref-link-text').innerText = getReferralLink();
        document.getElementById('total-refs').innerText = data.referidos;
        document.getElementById('total-earned').innerText = (data.referidos * 1.5).toFixed(2) + ' USDT';
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
        showToast('Verificando tarea...');
    }
}

function claimBotTask(taskId) {
    if (!userId) return;
    if (confirm("¿Ya te registraste en el bot? Se te abonará la recompensa.")) {
        fetch('/api/claim-task', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, taskId })
        }).then(res => res.json()).then(data => {
            showToast(data.message || data.error, !data.success);
            if (data.success) loadUserData();
        });
    }
}

function copyLink() {
    navigator.clipboard.writeText(getReferralLink()).then(() => {
        showToast('¡Enlace copiado al portapapeles!');
    });
}

function shareTelegram() {
    const text = encodeURIComponent("¡Únete a GoldNexus y gana USDT por completar tareas! 🚀");
    const url = encodeURIComponent(getReferralLink());
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
}

function shareGeneral() {
    if (navigator.share) {
        navigator.share({
            title: 'GoldNexus Rewards',
            text: '¡Únete y gana USDT!',
            url: getReferralLink(),
        }).catch(console.error);
    } else {
        copyLink();
    }
}

document.getElementById('checkin-btn').addEventListener('click', () => {
    if (!userId) return showToast("Abre esto desde Telegram", true);
    fetch('/api/checkin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    }).then(res => res.json()).then(data => {
        showToast(data.message || data.error, !data.success);
        if (data.success) loadUserData();
    });
});

// --- LÓGICA DE RETIRO ---
function requestWithdraw() {
    if (!userId) return showToast("Abre esto desde Telegram", true);
    
    const wallet = document.getElementById('wallet-input').value;
    if (!wallet || wallet.length < 20) return showToast('Dirección de wallet inválida', true);
    
    const amount = parseFloat(document.getElementById('withdraw-balance').innerText);
    if (amount < 10) return showToast('El mínimo de retiro es 10 USDT', true);

    fetch('/api/withdraw', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount, wallet })
    }).then(res => res.json()).then(data => {
        showToast(data.message || data.error, !data.success);
        if (data.success) {
            document.getElementById('wallet-input').value = '';
            loadUserData();
        }
    });
}

loadUserData();
