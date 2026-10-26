const tg = window.Telegram.WebApp;
tg.expand();
const userId = tg.initDataUnsafe?.user?.id;

const ROBOT_ICON = "https://raw.githubusercontent.com/hyuuknbctuuhfd/GoldenNexus2026/main/public/robot.png";
const MEGAFONO_ICON = "https://raw.githubusercontent.com/hyuuknbctuuhfd/GoldenNexus2026/main/public/megafono.png";

// --- NOMBRES FALSOS PARA LOS MENSAJES DE RETIRO ---
const fakeUsers = ["@CryptoKing_99", "@MariaCrypto", "@Elon_Fan", "@AirdropHunter", "@TonMaster", "@Faraon_Pro", "@GoldDigger", "@BTC_Lover", "@SandWalker", "@NileTrader", "@Scarab_777", "@PyramidX", "@Anubis_Rich", "@Cleopatra_VIP", "@Osiris_Earn", "@Crypto_Advisor", "@Satoshi_Fan", "@Ethereum_Whale", "@USDT_Master", "@Binance_Pro", "@Telegram_Earner", "@Lucky_User", "@Web3_Gamer", "@NFT_Collector", "@DeFi_King", "@CryptoNinja", "@MoonBoy", "@HODLer_2024", "@Altcoin_Hunter", "@Blockchain_Bro", "@Smart_Trader", "@Crypto_Guru", "@Earn_Daily", "@Passive_Income", "@Micro_Task_Pro", "@Cash_Hunter", "@Gold_Rush", "@Token_Whale", "@Satoshi_Nakamoto", "@Vitalik_Fan", "@Crypto_Wolf", "@Falcon_Trade", "@Bull_Market", "@Cobra_Coin", "@Lion_Heart", "@Eagle_Eye", "@Tiger_Trade", "@Shark_Invest", "@Dragon_Crypto", "@Phoenix_Rise", "@Alpha_Wolf", "@Beta_Tester"];

// --- LÓGICA DE LA BARRA DE CAPITAL (750,000 USDT) ---
const totalCapital = 750000;
const capitalPerHour = 1000; 
const capitalPerSecond = capitalPerHour / 3600;

// Fijamos una fecha de inicio en el pasado para que ya se vea movimiento
const startDate = new Date();
startDate.setHours(startDate.getHours() - 5); // Simula que empezó hace 5 horas
const startTime = startDate.getTime();

function updateCapital() {
    const capitalEl = document.getElementById('capital-amount');
    const fillEl = document.getElementById('capital-fill');
    
    if (capitalEl && fillEl) {
        const ahora = new Date();
        const horaActual = ahora.getHours(); 
        const estaActivo = (horaActual >= 8 && horaActual <= 23); // Baja solo de 8 AM a 11 PM
        
        const tiempoTranscurridoMs = Date.now() - startTime;
        
        // El capital baja constantemente (simulando que el proyecto gasta dinero)
        let currentVal = totalCapital - ((tiempoTranscurridoMs / 1000) * capitalPerSecond);
        
        if (currentVal < 0) currentVal = 0;
        
        capitalEl.innerText = Math.floor(currentVal).toLocaleString('en-US') + ' USDT';
        fillEl.style.width = ((currentVal / totalCapital) * 100) + '%';
    }
    
    setTimeout(updateCapital, 1000);
}
updateCapital();

// --- MENSAJES FLOTANTES DE RETIRO CADA 30 SEGUNDOS ---
function showFakeWithdrawal() {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const randomUser = fakeUsers[Math.floor(Math.random() * fakeUsers.length)];
    const randomAmount = (Math.random() * (50 - 10) + 10).toFixed(2);
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `💸 Retiro exitoso para <b>${randomUser}</b> por <b>${randomAmount} USDT</b>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 4500);
}

setTimeout(() => {
    showFakeWithdrawal();
    setInterval(showFakeWithdrawal, 30000); 
}, 5000);

// --- FUNCIONES BASE ---
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
    return `https://t.me/Paynexs_bot?start=${userId}`;
}

function createTaskHTML(task, completed) {
    const isBotTask = task.link.includes('bot?start=') || task.link.includes('Bot?start=') || task.link.includes('bot');
    const iconUrl = isBotTask ? ROBOT_ICON : MEGAFONO_ICON;
    
    let buttonHTML = '';

    if (completed) {
        buttonHTML = `<button class="btn-claim" disabled style="opacity:0.5; background:#333; color:#888;">Completado</button>`;
    } else {
        const hasClickedJoin = sessionStorage.getItem(`joined_${task.id}`);
        if (hasClickedJoin) {
            buttonHTML = `<button class="btn-claim" style="background: #ffd700; color: #000;" onclick="claimTaskDirectly(${task.id})">Reclamar</button>`;
        } else {
            const btnText = isBotTask ? "Ir al Bot" : "Unirse";
            const btnColor = isBotTask ? "background: #0088cc; color: white;" : "";
            buttonHTML = `<button class="btn-claim" style="${btnColor}" onclick="joinAndWait('${task.link}', ${task.id})">${btnText}</button>`;
        }
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
}

function loadUserData() {
    if (!userId) return;
    
    fetch(`/api/user/${userId}`).then(res => res.json()).then(data => {
        // BLINDAJE CONTRA EL NaN
        const safeBalance = (data && data.balance !== undefined && data.balance !== null && !isNaN(data.balance)) ? data.balance : 0.00;
        
        animateValue('balance', 0, safeBalance, 1500);
        document.getElementById('withdraw-balance').innerText = safeBalance.toFixed(2);
        const receiveAmount = Math.max(0, safeBalance); 
        document.getElementById('receive-amount').innerText = receiveAmount.toFixed(2) + ' USDT';
        document.getElementById('ref-link-text').innerText = getReferralLink();
        document.getElementById('total-refs').innerText = data.referidos || 0;
        document.getElementById('total-earned').innerText = ((data.referidos || 0) * 1.5).toFixed(2) + ' USDT';

        // BLINDAJE DEL AVISO DE 24 HORAS (Sin importar la hora del servidor)
        const fechaRegistro = new Date(data.created_at).getTime();
        const ahora = new Date().getTime();
        const horasTranscurridas = (ahora - fechaRegistro) / (1000 * 60 * 60);
        
        const warningDiv = document.getElementById('withdraw-warning');
        if (warningDiv) {
            if (horasTranscurridas < 24) {
                warningDiv.style.display = 'block';
                warningDiv.innerHTML = `⏳ <b>Cuenta nueva:</b> Debes esperar al menos <b>1 día (24 horas)</b> desde tu registro para retirar. ¡Sigue completando tareas!`;
            } else { 
                warningDiv.style.display = 'none'; 
            }
        }

    }).catch(err => console.log(err));
    
    fetch('/api/ranking').then(res => res.json()).then(data => {
        document.getElementById('ranking-list').innerHTML = data.map((u, i) => {
            let medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
            return `<div class="rank-item"><span>${medal} ${u.username}</span><span class="points">${u.referidos} refs</span></div>`;
        }).join('');
    }).catch(err => console.log(err));

    fetch(`/api/tasks/${userId}`).then(res => res.json()).then(data => {
        const tasksContainer = document.getElementById('tasks-container');
        const homeTasksContainer = document.getElementById('home-tasks-container');
        
        if (data.tasks && data.tasks.length > 0) {
            let tasksHTML = '';
            let homeTasksHTML = '';

            data.tasks.forEach(task => {
                const completed = data.completedIds.includes(task.id);
                const taskHtml = createTaskHTML(task, completed);
                tasksHTML += taskHtml;
                const isBotTask = task.link.includes('bot?start=') || task.link.includes('Bot?start=') || task.link.includes('bot');
                if (!isBotTask) homeTasksHTML += taskHtml;
            });

            tasksContainer.innerHTML = tasksHTML;
            homeTasksContainer.innerHTML = homeTasksHTML;
        } else {
            tasksContainer.innerHTML = `<p style="text-align:center; color:#889988; margin-top:20px;">No hay tareas disponibles ahora.</p>`;
        }
    }).catch(err => console.log(err));
}

function joinAndWait(link, taskId) {
    window.open(link, '_blank');
    sessionStorage.setItem(`joined_${taskId}`, 'true');
    showToast('¡Ya te uniste! Vuelve y toca Reclamar.');
    setTimeout(() => loadUserData(), 1000);
}

function claimTaskDirectly(taskId) {
    if (!userId) return;
    fetch('/api/claim-task', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId })
    }).then(res => res.json()).then(data => {
        showToast(data.message || data.error, !data.success);
        if (data.success) {
            sessionStorage.removeItem(`joined_${taskId}`);
            loadUserData();
        }
    });
}

function copyLink() {
    navigator.clipboard.writeText(getReferralLink()).then(() => {
        showToast('¡Enlace copiado al portapapeles!');
    });
}

function shareTelegram() {
    const text = encodeURIComponent("🔥 Bro, estoy ganando USDT como nunca con este bot. Únete con mi enlace antes de que se acabe el capital:");
    const url = encodeURIComponent(getReferralLink());
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
}

function shareGeneral() {
    if (navigator.share) {
        navigator.share({
            title: 'PayNex Rewards',
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

let selectedNetwork = 'BEP20';
function selectNetwork(network, btnElement) {
    selectedNetwork = network;
    document.querySelectorAll('.network-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
}

function requestWithdraw() {
    if (!userId) return showToast("Abre esto desde Telegram", true);
    const wallet = document.getElementById('wallet-input').value;
    if (!wallet || wallet.length < 20) return showToast('Dirección de wallet inválida', true);
    const amount = parseFloat(document.getElementById('withdraw-balance').innerText);
    if (amount < 10) return showToast('El mínimo de retiro es 10 USDT', true);

    fetch('/api/withdraw', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount, wallet, network: selectedNetwork })
    }).then(res => res.json()).then(data => {
        showToast(data.message || data.error, !data.success);
        if (data.success) {
            document.getElementById('wallet-input').value = '';
            loadUserData();
        }
    });
}

loadUserData();
