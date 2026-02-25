// === ตั้งค่าเริ่มต้น ===
const RANK_STYLES = {
    'SSR': { bg: 'bg-gradient-to-br from-yellow-100 to-amber-200 ssr-glow', border: 'border-yellow-400', text: 'text-amber-900 font-extrabold', grad: 'from-amber-400 to-yellow-600', hex: 'text-yellow-400', shareBg: 'bg-yellow-500/10 border border-yellow-500/30' },
    'SR': { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-900 font-bold', grad: 'from-purple-400 to-purple-600', hex: 'text-purple-400', shareBg: 'bg-purple-500/10 border border-purple-500/30' },
    'R': { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-900 font-bold', grad: 'from-blue-400 to-blue-600' },
    'A': { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-900 font-bold', grad: 'from-emerald-400 to-emerald-600' },
    'B': { bg: 'bg-lime-100', border: 'border-lime-300', text: 'text-lime-900 font-bold', grad: 'from-lime-400 to-lime-600' },
    'C': { bg: 'bg-white', border: 'border-slate-300', text: 'text-slate-800 font-bold', grad: 'from-slate-300 to-slate-400' },
    'E': { bg: 'bg-slate-200', border: 'border-slate-400', text: 'text-slate-700 font-bold', grad: 'from-slate-400 to-slate-500' }
};
const RANK_POINTS = { 'SSR': 500, 'SR': 100, 'R': 20, 'A': 15, 'B': 5, 'C': 2, 'E': 1 };

let bannersList = {};
let currentBannerId = ''; 
let currentBanner = null;

let history = [], totalPulls = 0, isSpinning = false, currentAnimationInterval = null, pullTimeout = null;
let currentPullsToAnimate = [];
let isOverlayAnimating = false, isAutoPulling = false, autoPullCount = 0, currentLuckData = {};
let holdTimer = null, isHolding = false;
const HOLD_DURATION = 600;

// 🎯 ฟังก์ชันเริ่มต้นแอป
async function initApp() {
    try {
        const listRes = await fetch('data/banners_list.json');
        if (!listRes.ok) throw new Error("ไม่พบไฟล์ banners_list.json");
        bannersList = await listRes.json();
        
        const urlParams = new URLSearchParams(window.location.search);
        const bannerFromUrl = urlParams.get('banner');
        const savedBanner = localStorage.getItem('lastGachaBanner');

        if (bannerFromUrl && bannersList[bannerFromUrl]) {
            currentBannerId = bannerFromUrl;
        } else if (savedBanner && bannersList[savedBanner]) {
            currentBannerId = savedBanner;
        } else {
            currentBannerId = Object.keys(bannersList)[0];
        }
        
        await loadBanner(currentBannerId);
        
        // สั่งซ่อนหน้า Loading หลังจากเตรียม UI เสร็จ
        setTimeout(() => {
            const preloader = document.getElementById('app-preloader');
            if (preloader) {
                preloader.style.opacity = '0';
                setTimeout(() => preloader.style.display = 'none', 500);
            }
        }, 800);

    } catch (error) {
        console.error("เกิดข้อผิดพลาดตอนเริ่มแอป: ", error);
        document.getElementById('main-title-1').innerText = "ERROR";
        document.getElementById('main-title-2').innerText = "LOADING DATA";
        const preloader = document.getElementById('app-preloader');
        if(preloader) preloader.style.display = 'none';
    }
}

// 🎯 ฟังก์ชันดึงข้อมูลตู้และฉีด CSS Variables แบบ Lazy Load ภาพพื้นหลัง
async function loadBanner(targetId) {
    if (isSpinning || isOverlayAnimating || isAutoPulling) return;
    
    try {
        const res = await fetch(`data/${targetId}.json`);
        if (!res.ok) throw new Error(`ไม่พบไฟล์ตู้ ${targetId}.json`);
        
        currentBanner = await res.json();
        currentBannerId = targetId;
        
        localStorage.setItem('lastGachaBanner', targetId);
        
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?banner=' + targetId;
        window.history.replaceState({ path: newUrl }, '', newUrl);
        
        if (currentBanner.themeColors) {
            const bgMain = currentBanner.themeColors['--bg-main'];
            
            // 1. ลงสีทั้งหมดบนหน้าเว็บทันทีก่อน (ไม่รอรูป)
            Object.entries(currentBanner.themeColors).forEach(([key, value]) => {
                if (key !== '--bg-main') {
                    document.documentElement.style.setProperty(key, value);
                }
            });

            // 2. ซ่อนภาพพื้นหลังเดิมก่อน
            document.documentElement.style.setProperty('--bg-main', 'none');

            // 3. เริ่มโหลดภาพพื้นหลังแบบเบื้องหลัง (Lazy Load)
            if (bgMain && bgMain !== 'none') {
                const urlMatch = bgMain.match(/url\(['"]?(.*?)['"]?\)/);
                if (urlMatch && urlMatch[1]) {
                    const imgUrl = urlMatch[1];
                    // หน่วงเวลาให้ CPU ประมวลผล UI หลักให้เสร็จก่อน แล้วค่อยดึงภาพใหญ่มา
                    setTimeout(() => {
                        const img = new Image();
                        img.onload = () => {
                            // โหลดภาพเสร็จค่อยสาดขึ้นหน้าจอ
                            document.documentElement.style.setProperty('--bg-main', bgMain);
                        };
                        img.src = imgUrl;
                    }, 200);
                } else {
                    document.documentElement.style.setProperty('--bg-main', bgMain);
                }
            }
        }
        
        updateUI();
        resetData();
        renderRates();
        preloadImages();
    } catch (error) {
        console.error("ไม่พบข้อมูลตู้กาชานี้: ", error);
    }
}

// 🎯 ฟังก์ชันสลับตู้จาก Dropdown
function switchBanner(targetId) {
    document.getElementById('banner-dropdown-menu').classList.add('hidden');
    loadBanner(targetId);
}

window.addEventListener('click', function(e) {
    const container = document.getElementById('banner-dropdown-container');
    const menu = document.getElementById('banner-dropdown-menu');
    if (container && !container.contains(e.target) && menu) {
        menu.classList.add('hidden');
    }
});

function toggleDropdown() {
    if (isSpinning || isOverlayAnimating || isAutoPulling) return;
    const menu = document.getElementById('banner-dropdown-menu');
    if (menu) menu.classList.toggle('hidden');
}

function updateUI() {
    if (!currentBanner || !bannersList[currentBannerId]) return;

    document.getElementById('dropdown-current-egg').src = bannersList[currentBannerId].eggImage;
    document.getElementById('dropdown-current-name').innerText = bannersList[currentBannerId].name;
    renderDropdownMenu();

    document.getElementById('main-title-1').innerText = currentBanner.title1;
    document.getElementById('main-title-2').innerText = currentBanner.title2;
    document.getElementById('share-title-1').innerText = currentBanner.title1;
    document.getElementById('share-title-2').innerText = currentBanner.title2;
    
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
                ${isActive ? '<svg class="w-4 h-4 ml-auto text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' : ''}
            </button>
        `;
    }
    container.innerHTML = html;
}

function startHold(e) {
    if (isSpinning || !currentBanner) return;
    isHolding = false;
    const egg = document.getElementById('egg-img');
    egg.classList.add('egg-charging');
    
    holdTimer = setTimeout(() => {
        isHolding = true;
        egg.classList.remove('egg-charging');
        if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
        pull(10);
    }, HOLD_DURATION);
}

function endHold(e) {
    if (isSpinning && !isHolding) return;
    clearTimeout(holdTimer);
    const egg = document.getElementById('egg-img');
    egg.classList.remove('egg-charging');
    if (!isHolding && !isSpinning && currentBanner) { pull(1); }
    isHolding = false;
}

function cancelHold(e) {
    clearTimeout(holdTimer);
    isHolding = false;
    document.getElementById('egg-img').classList.remove('egg-charging');
}

function preloadImages() { 
    if (!currentBanner) return;
    const allImages = new Set([currentBanner.eggImage]);
    currentBanner.items.forEach(i => allImages.add(i.imgSrc));
    const imageArray = Array.from(allImages);
    
    // 🚀 อัปเกรด: ทยอยโหลดรูปในพื้นหลังแบบต่อคิว (Background Queue Preload)
    // ป้องกันอาการมือถือค้างจากการเรียกดึงรูป 30+ รูปพร้อมกันในเสี้ยววินาที
    imageArray.forEach((src, index) => {
        setTimeout(() => {
            const img = new Image();
            img.src = src;
        }, index * 100); // หน่วงเวลาโหลดรูปละ 100 มิลลิวินาที ทยอยมาเรื่อยๆ
    });
}

function updateCost() { 
    const price = parseFloat(document.getElementById('price-per-pull').value) || 0; 
    const totalCost = totalPulls * price; 
    document.getElementById('total-cost-text').innerText = totalCost.toLocaleString(); 
    return totalCost; 
}

function renderRates() { 
    if (!currentBanner) return;
    let html = ''; 
    for (const [rank, rate] of Object.entries(currentBanner.rates)) { 
        const style = RANK_STYLES[rank]; 
        html += `<div class="flex justify-between items-center text-[10px] font-medium"><span class="w-8 font-black text-transparent bg-clip-text bg-gradient-to-b ${style.grad}">${rank}</span><div class="flex-1 mx-3 h-1 bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r ${style.grad}" style="width: ${rate}%"></div></div><span class="text-slate-400 w-10 text-right">${rate}%</span></div>`; 
    } 
    document.getElementById('rates-container').innerHTML = html; 
}

function updateLuckMeter() {
    const container = document.getElementById('luck-meter-container');
    if (totalPulls === 0 || !currentBanner) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');
    
    let totalPoints = 0, ssrCount = 0;
    history.forEach(item => { totalPoints += RANK_POINTS[item.rank] || 0; if (item.rank === 'SSR') ssrCount++; });
    
    const expectedScore = currentBanner.expectedScore || 10.43;
    const luckRatio = (totalPoints / totalPulls) / expectedScore;
    const luckPercent = (luckRatio * 100).toFixed(0);
    
    let tN, tD, tC, funQuote;
    if (luckRatio >= 3.0) { tN = '👼 จุติมาเกิด'; tD = 'GOD TIER!'; tC = 'text-amber-400'; funQuote = '"หล่อเท่กว่านี้ก็เทพเจ้าแล้ว!"'; } 
    else if (luckRatio >= 2.0) { tN = '👑 ลูกรัก GM'; tD = 'GM PICKET!'; tC = 'text-purple-400'; funQuote = '"ระวังสิบล้อตอนเดินข้ามถนนด้วยนะเพื่อน!"'; } 
    else if (luckRatio >= 1.5) { tN = '🌟 โคตรเฮง'; tD = 'SUPER LUCKY!'; tC = 'text-pink-400'; funQuote = '"ของมันแรง แข่งบุญวาสนามันไม่ได้จริงๆ"'; } 
    else if (luckRatio >= 1.2) { tN = '✨ ดวงดี'; tD = 'LUCKY!'; tC = 'text-blue-400'; funQuote = '"แหมมม ทำมาเป็นขิง!"'; } 
    else if (luckRatio >= 1.0) { tN = '😏 คุ้มทุน'; tD = 'PROFIT!'; tC = 'text-cyan-400'; funQuote = '"กำไรเน้นๆ ไม่ขาดทุนก็บุญแล้ว"'; } 
    else if (luckRatio >= 0.85) { tN = '😐 ปกติชน'; tD = 'AVERAGE'; tC = 'text-green-400'; funQuote = '"เรื่อยๆ มาเรียงๆ ตามมาตรฐานสถิติ"'; } 
    else if (luckRatio >= 0.7) { tN = '🤏 แอบเกลือ'; tD = 'SLIGHTLY SALTY'; tC = 'text-yellow-500'; funQuote = '"ได้กลิ่นเกลือโชยมาแต่ไกล..."'; } 
    else if (luckRatio >= 0.5) { tN = '🧂 เกลือ'; tD = 'SALTY'; tC = 'text-orange-400'; funQuote = '"เค็มปี๋เลยลูกพี่ ไตจะพังแล้ว!"'; } 
    else if (luckRatio >= 0.3) { tN = '🏜️ โคตรเกลือ'; tD = 'VERY SALTY'; tC = 'text-orange-600'; funQuote = '"แห้งแล้งเหลือเกิน ถอนตัวตอนนี้ยังทัน"'; } 
    else { tN = '💀 ทะเลเดดซี'; tD = 'EXTREME SALT'; tC = 'text-red-500'; funQuote = '"สวดอภิธรรมศพกระเป๋าตังค์ ลบเกมทิ้งเถอะ"'; }
    
    document.getElementById('luck-tier-name').innerText = tN; 
    document.getElementById('luck-tier-name').className = `text-xl font-black mb-1 ${tC}`;
    document.getElementById('luck-tier-desc').innerText = tD; 
    document.getElementById('luck-score-text').innerText = `${luckPercent}%`;
    document.getElementById('luck-ssr-actual').innerText = ssrCount.toLocaleString(); 
    document.getElementById('luck-ssr-expected').innerText = (totalPulls * (currentBanner.rates.SSR / 100)).toFixed(2);
    
    currentLuckData = { tN, tD, tC, luckPercent, ssrCount, funQuote };
}

function createOverlayItemHTML(item) {
    const style = RANK_STYLES[item.rank];
    let bgEffect = item.rank === 'SSR' ? `<div class="absolute inset-0 shimmer mix-blend-overlay pointer-events-none rounded-xl"></div>` : '';
    return `<div class="${style.bg} border ${style.border} p-2 rounded-xl text-center flex flex-col items-center justify-between min-h-[100px] relative overflow-hidden group animate-pop-up shadow-xl backdrop-blur-md">${bgEffect}<img src="${item.imgSrc}" alt="${item.name}" class="w-12 h-12 mt-2 z-10 object-contain mix-blend-multiply" /><div class="z-10 w-full mt-1 pb-1 relative"><p class="text-[9px] leading-tight line-clamp-2 ${style.text}">${item.name}</p></div></div>`;
}

function openShareModal() {
    if (totalPulls === 0 || !currentBanner) return;
    const modal = document.getElementById('share-modal'), loading = document.getElementById('share-loading'), resultImg = document.getElementById('share-result-img');
    modal.classList.remove('hidden'); modal.classList.add('flex'); loading.classList.remove('hidden'); resultImg.classList.add('hidden');
    
    const totalCost = updateCost();
    document.getElementById('tpl-luck-name').innerText = currentLuckData.tN;
    document.getElementById('tpl-luck-name').className = `text-[26px] leading-none font-black text-white drop-shadow-[0_4px_10px_rgba(0,0,0,1)] mb-4 ${currentLuckData.tC} uppercase tracking-[0.3em]`;
    document.getElementById('tpl-fun-quote').innerText = currentLuckData.funQuote;
    document.getElementById('tpl-cost').innerText = totalCost.toLocaleString() + ' ฿';
    document.getElementById('tpl-pulls').innerText = totalPulls.toLocaleString() + ' โรล';
    document.getElementById('tpl-ssr-count').innerText = `SSR: ${currentLuckData.ssrCount.toLocaleString()}`;
    
    const mc = document.getElementById('share-magic-circle'); 
    if (mc) { 
        mc.style.top = `${Math.floor(Math.random() * 40) + 30}%`; 
        mc.style.left = `${Math.floor(Math.random() * 40) + 30}%`; 
        mc.style.transform = `translate(-50%, -50%) scale(${Math.random() * 0.7 + 0.8}) rotate(${Math.floor(Math.random() * 360)}deg)`; 
    }
    
    const rareInventory = {}; 
    history.forEach(item => { 
        if(item.rank === 'SSR' || item.rank === 'SR') { 
            if (rareInventory[item.id]) rareInventory[item.id].totalCount += item.qty; 
            else rareInventory[item.id] = { ...item, totalCount: item.qty }; 
        } 
    });
    const sortedRares = Object.values(rareInventory).sort((a, b) => (a.rank === 'SSR' ? 1 : 2) - (b.rank === 'SSR' ? 1 : 2));
    const rg = document.getElementById('tpl-rare-grid'); 
    
    if (sortedRares.length === 0) {
        rg.innerHTML = `<div class="col-span-3 flex flex-col items-center justify-center py-12 text-6xl">🧂<p class="text-white text-xl font-bold mt-4">เกลือล้วนๆ!</p></div>`;
    } else { 
        let html = ''; 
        sortedRares.slice(0, 9).forEach(item => { 
            const s = RANK_STYLES[item.rank]; 
            const glow = item.rank === 'SSR' ? 'drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]' : 'drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]'; 
            html += `<div class="${s.shareBg} p-3 rounded-xl flex flex-col items-center text-center relative z-10 shadow-sm min-h-[130px]"><div class="absolute top-1 right-2 text-[20px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] z-20">x${item.totalCount}</div><img src="${item.imgSrc}" class="w-14 h-14 mb-2 object-contain ${glow}" crossorigin="anonymous" /><p class="text-[11px] font-bold text-white flex-1 leading-tight">${item.name}</p><p class="text-[12px] font-black uppercase ${s.hex}">${item.rank}</p></div>`; 
        }); 
        rg.innerHTML = html; 
    }
    
    const target = document.getElementById('share-template'); 
    const imgs = Array.from(target.querySelectorAll('img'));
    Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; }))).then(() => {
        setTimeout(() => html2canvas(target, { scale: 2, backgroundColor: '#090314', useCORS: true, logging: false }).then(canvas => { resultImg.src = canvas.toDataURL("image/png"); loading.classList.add('hidden'); resultImg.classList.remove('hidden'); }), 400);
    });
}

function closeShareModal() { document.getElementById('share-modal').classList.add('hidden'); }

function generateRandomItem() { 
    if (!currentBanner) return null;
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

function startPullAnimation(pulls) {
    currentPullsToAnimate = pulls; isOverlayAnimating = true;
    const overlay = document.getElementById('pull-overlay'), container = document.getElementById('overlay-items-container'), actions = document.getElementById('overlay-actions'), skip = document.getElementById('overlay-skip-text');
    container.innerHTML = ''; actions.classList.add('hidden'); skip.classList.remove('hidden'); overlay.classList.remove('hidden'); overlay.classList.add('flex');
    let idx = 0; if (currentAnimationInterval) clearInterval(currentAnimationInterval);
    
    container.insertAdjacentHTML('beforeend', createOverlayItemHTML(pulls[idx])); idx++;
    if (idx >= pulls.length) setTimeout(endAnimation, 300);
    else { 
        currentAnimationInterval = setInterval(() => { 
            if (idx >= pulls.length) { endAnimation(); return; } 
            container.insertAdjacentHTML('beforeend', createOverlayItemHTML(pulls[idx])); idx++; 
        }, 150); 
    }
}

function endAnimation() {
    isOverlayAnimating = false; clearInterval(currentAnimationInterval);
    document.getElementById('overlay-actions').classList.remove('hidden'); document.getElementById('overlay-actions').classList.add('flex'); document.getElementById('overlay-skip-text').classList.add('hidden');
    if (isAutoPulling || currentPullsToAnimate.some(p => p.rank === 'SSR')) {
        const spk = document.getElementById('sparkle-overlay'); spk.classList.remove('hidden'); spk.classList.add('flex');
        setTimeout(() => { spk.classList.add('hidden'); spk.classList.remove('flex'); }, 1500);
    }
}

// อัปเดตเพื่อรองรับการแสดงข้อความเป้าหมาย (SR หรือ SSR)
function finishAutoPullConfigurable(isSuccess, rankFound) {
    isAutoPulling = false; isSpinning = false; isOverlayAnimating = false; 
    if (pullTimeout) clearTimeout(pullTimeout); 
    if (currentAnimationInterval) clearInterval(currentAnimationInterval);

    document.getElementById('egg-img').classList.remove('animate-bounce');
    
    document.getElementById('btn-pull-until-ssr').disabled = false;
    const btnSr = document.getElementById('btn-pull-until-sr');
    if (btnSr) btnSr.disabled = false;
    
    document.getElementById('total-pulls-text').innerText = totalPulls.toLocaleString(); 
    updateCost(); updateLuckMeter(); renderInventory(); 
    
    const ct = document.getElementById('overlay-pull-count-text'); 
    const pr = (autoPullCount * (parseFloat(document.getElementById('price-per-pull').value) || 0)).toLocaleString();
    
    const rankText = rankFound || (window.currentAutoPullTarget === 'SR' ? 'SR' : 'SSR');
    ct.innerHTML = `🎉 ออก <span class="${rankText === 'SSR' ? 'text-amber-400' : 'text-purple-400'}">${rankText}</span> ในครั้งที่ <span class="text-white text-2xl mx-1">${autoPullCount}</span><br><span class="text-xs font-normal text-slate-400">ใช้เงินไป ${pr} ฿</span>`;
    
    document.getElementById('overlay-actions').classList.remove('hidden'); document.getElementById('overlay-skip-text').classList.add('hidden');
    
    // โชว์ออร่าแสงถ้าได้ SSR
    if (isSuccess && rankFound === 'SSR') { 
        const s = document.getElementById('sparkle-overlay'); 
        s.classList.remove('hidden'); s.classList.add('flex'); 
        setTimeout(() => s.classList.add('hidden'), 1500); 
    }
}

// อัปเดตให้กดข้ามระหว่างกำลังสุ่มออโต้แล้วหยุดให้ถูกเป้าหมาย
function handleOverlayClick(e) {
    if (e.target.closest('button')) return;
    if (isAutoPulling) { 
        let gS = false; 
        let foundRank = '';
        const targetRank = window.currentAutoPullTarget || 'SSR';
        if (currentAnimationInterval) clearInterval(currentAnimationInterval);
        
        while (!gS && autoPullCount < 5000) { 
            autoPullCount++; 
            const nI = generateRandomItem(); 
            history.push(nI); totalPulls++; 
            
            // เงื่อนไขในการข้ามออโต้
            if (targetRank === 'SSR' && nI.rank === 'SSR') { gS = true; foundRank = nI.rank; }
            if (targetRank === 'SR' && (nI.rank === 'SR' || nI.rank === 'SSR')) { gS = true; foundRank = nI.rank; }
        }
        const lp = history.slice(-15); const cn = document.getElementById('overlay-items-container'); cn.innerHTML = ''; lp.forEach(i => cn.insertAdjacentHTML('beforeend', createOverlayItemHTML(i)));
        finishAutoPullConfigurable(gS, foundRank);
    } else if (isOverlayAnimating) { 
        clearInterval(currentAnimationInterval); 
        const cn = document.getElementById('overlay-items-container');
        for (let i = cn.children.length; i < currentPullsToAnimate.length; i++) {
            cn.insertAdjacentHTML('beforeend', createOverlayItemHTML(currentPullsToAnimate[i]));
        }
        endAnimation(); 
    }
    else { if (!isSpinning) document.getElementById('pull-overlay').classList.add('hidden'); }
}

function pull(c, fO = false) {
    if (isSpinning || !currentBanner) return; 
    isSpinning = true; 
    document.getElementById('overlay-pull-count-text').classList.add('hidden');
    
    if (!fO) { 
        document.getElementById('btn-pull-until-ssr').disabled = true; 
        const btnSr = document.getElementById('btn-pull-until-sr');
        if (btnSr) btnSr.disabled = true;
        document.getElementById('egg-img').classList.add('animate-bounce'); 
    }
    
    const nP = []; 
    for (let i = 0; i < c; i++) nP.push(generateRandomItem());
    
    pullTimeout = setTimeout(() => {
        history = [...nP, ...history]; totalPulls += c; isSpinning = false;
        
        if (!fO) { 
            document.getElementById('btn-pull-until-ssr').disabled = false; 
            const btnSr = document.getElementById('btn-pull-until-sr');
            if (btnSr) btnSr.disabled = false;
            document.getElementById('egg-img').classList.remove('animate-bounce'); 
        }
        
        const ov = document.getElementById('pull-overlay'); ov.classList.remove('hidden'); ov.classList.add('flex');
        const cn = document.getElementById('overlay-items-container'); cn.innerHTML = ''; nP.forEach(i => cn.insertAdjacentHTML('beforeend', createOverlayItemHTML(i)));
        document.getElementById('overlay-actions').classList.remove('hidden'); document.getElementById('overlay-skip-text').classList.add('hidden');
        document.getElementById('total-pulls-text').innerText = totalPulls.toLocaleString();
        updateCost(); updateLuckMeter(); renderInventory();
        startPullAnimation(nP);
    }, fO ? 50 : 600);
}

// 🎯 ฟังก์ชันหลักสำหรับการสุ่มจนกว่าจะออก Rank ที่กำหนด
function pullUntilRank(targetRank) {
    if (isSpinning || !currentBanner) return; 
    isSpinning = true; isAutoPulling = true; autoPullCount = 0;
    const ov = document.getElementById('pull-overlay'), cn = document.getElementById('overlay-items-container'), ct = document.getElementById('overlay-pull-count-text');
    
    document.getElementById('btn-pull-until-ssr').disabled = true; 
    const btnSr = document.getElementById('btn-pull-until-sr');
    if (btnSr) btnSr.disabled = true;
    
    document.getElementById('egg-img').classList.add('animate-bounce');
    document.getElementById('overlay-actions').classList.add('hidden'); document.getElementById('overlay-skip-text').classList.remove('hidden'); 
    ct.classList.remove('hidden'); cn.innerHTML = ''; ov.classList.remove('hidden'); ov.classList.add('flex');
    
    window.currentAutoPullTarget = targetRank; // จำค่าไว้เผื่อถูกกดข้ามการแสดงผล
    
    currentAnimationInterval = setInterval(() => {
        if (!isAutoPulling) { clearInterval(currentAnimationInterval); return; }
        autoPullCount++; const nI = generateRandomItem(); history.push(nI); totalPulls++;
        
        if (cn.children.length >= 15) cn.innerHTML = ''; cn.insertAdjacentHTML('beforeend', createOverlayItemHTML(nI));
        ct.innerHTML = `กำลังสุ่มครั้งที่ <span class="text-white text-xl mx-1">${autoPullCount}</span>`; updateCost();
        
        let shouldStop = false;
        if (targetRank === 'SSR' && nI.rank === 'SSR') shouldStop = true;
        // ถ้าหา SR แล้วดันแจ็คพอตแตกได้ SSR ก่อน ก็ให้หยุดเหมือนกัน
        if (targetRank === 'SR' && (nI.rank === 'SR' || nI.rank === 'SSR')) shouldStop = true; 
        
        if (shouldStop || autoPullCount >= 5000) { 
            clearInterval(currentAnimationInterval); 
            finishAutoPullConfigurable(shouldStop, nI.rank); 
        }
    }, 150);
}

// ให้ปุ่มเดิมเรียกใช้ได้ปกติ
function pullUntilSSR() { pullUntilRank('SSR'); }
// ให้ปุ่มใหม่เรียกใช้
function pullUntilSR() { pullUntilRank('SR'); }

function renderInventory() {
    const section = document.getElementById('inventory-section'), container = document.getElementById('inventory-container'), emptyState = document.getElementById('empty-inventory-state');
    if (history.length === 0) { section.classList.add('hidden'); emptyState.classList.remove('hidden'); emptyState.classList.add('flex'); return; }
    section.classList.remove('hidden'); emptyState.classList.add('hidden'); emptyState.classList.remove('flex');
    const inventory = {}; history.forEach(item => { if (inventory[item.id]) inventory[item.id].totalCount += item.qty; else inventory[item.id] = { ...item, totalCount: item.qty }; });
    const rankOrder = { 'SSR': 1, 'SR': 2, 'R': 3, 'A': 4, 'B': 5, 'C': 6, 'E': 7 };
    const sortedItems = Object.values(inventory).sort((a, b) => rankOrder[a.rank] - rankOrder[b.rank]);
    let html = ''; sortedItems.forEach(item => {
        const style = RANK_STYLES[item.rank];
        let bgEffect = item.rank === 'SSR' ? `<div class="absolute inset-0 shimmer mix-blend-overlay pointer-events-none"></div>` : '';
        html += `<div class="${style.bg} border ${style.border} p-1.5 rounded-xl text-center flex flex-col items-center justify-between min-h-[90px] relative overflow-hidden shadow-sm">${bgEffect}<div class="absolute top-0.5 right-0.5 text-[8px] font-black px-1 py-0.5 rounded-md text-white bg-slate-900/80 shadow border border-slate-600 z-20">x${item.totalCount.toLocaleString()}</div><img src="${item.imgSrc}" alt="${item.name}" class="w-10 h-10 mt-3 z-10 object-contain mix-blend-multiply" crossorigin="anonymous" /><div class="z-10 w-full pb-0.5 relative"><p class="text-[8px] leading-tight line-clamp-2 ${style.text}">${item.name}</p></div></div>`;
    }); container.innerHTML = html;
}

function resetData() { history = []; totalPulls = 0; document.getElementById('total-pulls-text').innerText = '0'; updateCost(); updateLuckMeter(); renderInventory(); }

// 🎯 สั่งรันแอปตอนเปิดเว็บ
window.onload = () => { 
    initApp(); 
};
