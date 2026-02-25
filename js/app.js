// === ตั้งค่าเริ่มต้น ===
const RANK_STYLES = {
    'SSR': { bg: 'bg-gradient-to-br from-yellow-100 to-amber-200 ssr-glow', border: 'border-yellow-400', text: 'text-amber-900 font-extrabold', grad: 'from-amber-400 to-yellow-600', hex: 'text-yellow-400', shareBg: 'bg-yellow-500/10 border border-yellow-500/30' },
    // ... (ใส่ RANK_STYLES ที่เหลือให้ครบ)
};
const RANK_POINTS = { 'SSR': 500, 'SR': 100, 'R': 20, 'A': 15, 'B': 5, 'C': 2, 'E': 1 };

let bannersList = {};
let currentBannerId = 'aquarius';
let currentBanner = null;

let history = [], totalPulls = 0, isSpinning = false, currentAnimationInterval = null, pullTimeout = null;
let isOverlayAnimating = false, isAutoPulling = false, autoPullCount = 0, currentLuckData = {};
let holdTimer = null, isHolding = false;
const HOLD_DURATION = 600;

// 🎯 ฟังก์ชันโหลดข้อมูลตู้แรกตอนเปิดเว็บ
async function initApp() {
    try {
        // 1. โหลดรายชื่อตู้ทั้งหมด
        const listRes = await fetch('data/banners_list.json');
        bannersList = await listRes.json();
        
        // 2. โหลดตู้เริ่มต้น (Aquarius)
        await loadBanner(currentBannerId);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการโหลดข้อมูล: ", error);
        alert("ไม่สามารถโหลดข้อมูลกาชาได้ โปรดเช็คการเชื่อมต่อ");
    }
}

// 🎯 ฟังก์ชันโหลดข้อมูลเจาะจงแต่ละตู้
async function loadBanner(targetId) {
    if (isSpinning || isOverlayAnimating || isAutoPulling) return;
    
    try {
        const res = await fetch(`data/${targetId}.json`);
        currentBanner = await res.json();
        currentBannerId = targetId;
        
        updateUI();
        resetData();
        renderRates();
    } catch (error) {
        console.error("ไม่พบข้อมูลตู้กาชานี้: ", error);
    }
}

// 🎯 ฟังก์ชันเปลี่ยนตู้เมื่อกดจาก Dropdown
function switchBanner(targetId) {
    document.getElementById('banner-dropdown-menu').classList.add('hidden');
    loadBanner(targetId);
}

// 🎯 ฟังก์ชันอัปเดตหน้าจอหลัก (UI) เมื่อโหลดข้อมูลสำเร็จ
function updateUI() {
    // อัปเดต Dropdown
    document.getElementById('dropdown-current-egg').src = bannersList[currentBannerId].eggImage;
    document.getElementById('dropdown-current-name').innerText = bannersList[currentBannerId].name;
    renderDropdownMenu();

    // อัปเดต Title
    const mt1 = document.getElementById('main-title-1');
    const mt2 = document.getElementById('main-title-2');
    mt1.innerText = currentBanner.title1;
    mt2.innerText = currentBanner.title2;
    mt1.className = currentBanner.theme.mainT1;
    mt2.className = currentBanner.theme.mainT2;
    
    // อัปเดตรูปไข่
    document.getElementById('egg-img').src = currentBanner.eggImage;
    document.getElementById('share-egg-img').src = currentBanner.eggImage;
}

function renderDropdownMenu() {
    const container = document.getElementById('banner-list-container');
    let html = '';
    for (const key in bannersList) {
        const banner = bannersList[key];
        const isActive = currentBannerId === key;
        html += `
            <button onclick="switchBanner('${key}')" class="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors ${isActive ? 'bg-slate-800/80 border-l-2 border-cyan-500' : 'border-l-2 border-transparent'} text-left group">
                <img src="${banner.eggImage}" class="w-8 h-8 object-contain drop-shadow-sm group-hover:scale-110 transition-transform" />
                <span class="font-bold text-sm ${isActive ? 'text-cyan-400' : 'text-slate-300 group-hover:text-white'}">${banner.name}</span>
            </button>



        `;
    }
    container.innerHTML = html;
}

// ... นำฟังก์ชันสุ่ม (pull, pullUntilSSR, startHold, renderInventory) จากของเดิมมาใส่ต่อท้ายได้เลย ...
// ... สิ่งเดียวที่ต้องแก้คือฟังก์ชัน generateRandomItem() ให้เปลี่ยนการเรียกจาก ITEMS เป็น currentBanner.items ครับ ...

function generateRandomItem() { 
    const rand = Math.random() * 100; 
    let cum = 0; 
    for (const [rank, rate] of Object.entries(currentBanner.rates)) { 
        cum += rate; 
        if (rand <= cum) { 
            const pos = currentBanner.items.filter(i => i.rank === rank); 
            return pos[Math.floor(Math.random() * pos.length)]; 
        } 
    } 
    return currentBanner.items[currentBanner.items.length - 1]; 
}

// 🎯 สั่งรันแอปตอนเปิดเว็บ
window.onload = () => { 
    initApp(); 
};
