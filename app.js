/* ============================================
   POAR ESTÉTICA — Shared Application Logic
   UI helpers, utilities, common renders
   ============================================ */

// ========== GLOBAL STATE ==========
let currentUserProfile = null;
let authReady = false;
let _authReadyResolve = null;
const authReadyPromise = new Promise(r => { _authReadyResolve = r; });

// Initialize auth listener ONCE
(function setupAuthListener() {
    onAuthChange(async (user) => {
        if (user) {
            currentUserProfile = await getUserProfile(user.uid);
            if (currentUserProfile) {
                currentUserProfile.uid = user.uid;
                currentUserProfile.firebaseUser = user;
            }
        } else {
            currentUserProfile = null;
        }
        authReady = true;
        _authReadyResolve(currentUserProfile);
        document.dispatchEvent(new CustomEvent('authReady', { detail: currentUserProfile }));
    });
})();

/** Wait for Firebase Auth to resolve. Returns user profile or null. */
async function initAuth() {
    if (authReady) return currentUserProfile;
    return authReadyPromise;
}

/**
 * Force-refresh user profile from Firestore (use after login/register).
 */
async function refreshProfile() {
    const user = auth.currentUser;
    if (user) {
        currentUserProfile = await getUserProfile(user.uid);
        if (currentUserProfile) {
            currentUserProfile.uid = user.uid;
            currentUserProfile.firebaseUser = user;
        }
    } else {
        currentUserProfile = null;
    }
    return currentUserProfile;
}

function isLoggedIn() { return !!currentUserProfile; }
function isAdmin() { return currentUserProfile && currentUserProfile.role === 'gestao'; }
function getProfile() { return currentUserProfile; }

// ========== TOAST ==========
function showToast(message, type) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast' + (type ? ' toast-' + type : '');
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ========== MODAL HELPERS ==========
function openModal(overlayId, sheetId) {
    const ov = document.getElementById(overlayId);
    const sh = document.getElementById(sheetId);
    if (ov) ov.classList.add('show');
    // Small delay for smoother animation
    requestAnimationFrame(() => {
        if (sh) sh.classList.add('show');
    });
    document.body.style.overflow = 'hidden';
}

function closeModal(overlayId, sheetId) {
    const sh = document.getElementById(sheetId);
    const ov = document.getElementById(overlayId);
    if (sh) sh.classList.remove('show');
    setTimeout(() => {
        if (ov) ov.classList.remove('show');
        document.body.style.overflow = '';
    }, 250);
}

// ========== FORMATTING ==========
function fmtPrice(v) {
    return parseFloat(v).toFixed(2).replace('.', ',');
}

function formatDateBR(dateStr) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
}

function formatDateShort(dateStr) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'short'
    });
}

function timeToMin(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function minToTime(m) {
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ========== PHONE MASK ==========
function applyPhoneMask(el) {
    if (!el) return;
    el.addEventListener('input', function (e) {
        let v = e.target.value.replace(/\D/g, '').slice(0, 11);
        if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
        else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
        else if (v.length > 0) v = `(${v}`;
        e.target.value = v;
    });
}

// ========== AVAILABILITY SLOT GENERATION ==========
function generateTimeSlotsFromAvailability(availability, dayOfWeek) {
    const config = availability[String(dayOfWeek)];
    if (!config || !config.enabled) return [];

    const start = timeToMin(config.startTime || '08:00');
    const end = timeToMin(config.endTime || '18:00');
    const lunchStart = timeToMin(config.lunchStart || '12:00');
    const lunchEnd = timeToMin(config.lunchEnd || '13:00');

    const slots = [];
    for (let m = start; m < end; m += 30) {
        if (m >= lunchStart && m < lunchEnd) continue;
        slots.push(minToTime(m));
    }
    return slots;
}

// ========== BOOKING CONFLICT CHECK ==========
function getUnavailableReason(date, timeStr, service, bookings, allServices) {
    const slotStart = timeToMin(timeStr);
    const slotEnd = slotStart + service.duration + (service.prepTime || 0);

    if (slotEnd > 18 * 60) {
        return `Servico de ${service.duration}min nao cabe neste horario (ultrapassa o expediente)`;
    }

    for (const b of bookings.filter(b2 => b2.date === date && (b2.status === 'pendente' || b2.status === 'confirmado'))) {
        const bStart = timeToMin(b.time);
        const bSvc = allServices.find(s => s.id === b.serviceId);
        const bTotal = (b.duration || 0) + (b.prepTime || (bSvc ? bSvc.prepTime : 0) || 0);
        const bEnd = bStart + bTotal;

        if (slotStart < bEnd && slotEnd > bStart) {
            return `Conflito com "${b.serviceName}" agendado as ${b.time} (${b.duration}min + preparacao)`;
        }
    }
    return null;
}

function isSlotFullyBlocked(date, timeStr, bookings, allServices) {
    for (const svc of allServices) {
        if (!getUnavailableReason(date, timeStr, svc, bookings, allServices)) {
            return false;
        }
    }
    return true;
}

// ========== NAV: Update header/bottom nav ==========
function updateNavState() {
    const page = window.location.pathname.split('/').pop() || 'index.html';

    document.querySelectorAll('.desktop-nav .nav-link, .bottom-nav .nav-btn').forEach(el => {
        const href = el.getAttribute('href');
        if (href === page) el.classList.add('active');
        else el.classList.remove('active');
    });

    const headerName = document.getElementById('header-user-name');
    const headerBtn = document.getElementById('header-user-btn');

    if (currentUserProfile && headerName) {
        headerName.textContent = currentUserProfile.name || currentUserProfile.email.split('@')[0];
        if (headerBtn) {
            headerBtn.href = currentUserProfile.role === 'gestao' ? 'gestao.html' : 'login.html';
        }
    }

    const mobileLogin = document.querySelector('.bottom-nav a[href="login.html"]');
    if (currentUserProfile && mobileLogin) {
        mobileLogin.querySelector('span').textContent = currentUserProfile.name || 'Perfil';
        if (currentUserProfile.role === 'gestao') {
            mobileLogin.href = 'gestao.html';
        }
    }
}

// ========== SKELETON LOADERS ==========
function skeletonServiceCards(count) {
    return Array.from({ length: count }, () => `
        <div class="skeleton-service skeleton-card">
            <div class="skeleton skeleton-img"></div>
            <div class="skeleton-body">
                <div class="skeleton skeleton-text w-80"></div>
                <div class="skeleton skeleton-text w-40"></div>
                <div class="skeleton skeleton-text w-60" style="height:14px;margin-top:6px;"></div>
            </div>
        </div>`).join('');
}

function skeletonProductCards(count) {
    return Array.from({ length: count }, () => `
        <div class="skeleton-service skeleton-card" style="min-width:130px;max-width:130px;text-align:center;padding:14px;">
            <div class="skeleton" style="width:80px;height:80px;border-radius:var(--r-md);margin:0 auto 8px;"></div>
            <div class="skeleton skeleton-text w-80" style="margin:0 auto 4px;"></div>
            <div class="skeleton skeleton-text w-60" style="height:14px;margin:0 auto;"></div>
        </div>`).join('');
}

function skeletonCatalogGrid(count) {
    return Array.from({ length: count }, () => `
        <div class="skeleton-card">
            <div class="skeleton skeleton-img"></div>
            <div class="skeleton-body">
                <div class="skeleton skeleton-text w-80"></div>
                <div class="skeleton skeleton-text w-60"></div>
                <div class="skeleton skeleton-text w-40" style="height:14px;margin-top:6px;"></div>
            </div>
        </div>`).join('');
}

function skeletonCalendar() {
    return Array.from({ length: 35 }, () =>
        `<div class="skeleton" style="aspect-ratio:1;border-radius:var(--r-md);"></div>`
    ).join('');
}

function showPageLoading(el) {
    if (!el) return;
    el.innerHTML = `<div class="page-loading"><div class="spinner"></div><p>Carregando...</p></div>`;
}

function showLoading(el) {
    if (!el) return;
    el.innerHTML = `<div class="page-loading" style="min-height:20vh;"><div class="spinner"></div><p>Carregando...</p></div>`;
}

// ========== RENDER HOME HELPERS ==========
async function renderHomeServices() {
    const container = document.getElementById('home-services');
    if (!container) return;
    container.innerHTML = skeletonServiceCards(4);
    try {
        const services = await getServices();
        if (typeof homeServices !== 'undefined') homeServices = services;
        if (services.length === 0) {
            container.innerHTML = '<p class="text-sm text-muted" style="padding:0 20px;">Nenhum servico disponivel.</p>';
            return;
        }
        container.innerHTML = '';
        container.classList.add('stagger-in');
        container.innerHTML = services.slice(0, 6).map(s => `
            <div class="service-card" style="cursor:pointer;" onclick="openItemDetail('servico','${s.id}')">
                <div style="position:relative;">
                    <img src="${s.image || 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=300&fit=crop'}" alt="${s.name}" class="service-card-img" loading="lazy">
                    ${isAdmin() ? `<button class="edit-badge" onclick="event.stopPropagation(); openEditModal('${s.id}','servico')" title="Editar"><i class="fas fa-pen"></i></button>` : ''}
                </div>
                <div class="service-card-body">
                    <h4 class="service-card-name">${s.name}</h4>
                    <p class="service-card-meta"><i class="far fa-clock"></i> ${s.duration} min</p>
                    <p class="service-card-price">R$ ${fmtPrice(s.price)}</p>
                </div>
            </div>`).join('');
    } catch (err) {
        container.innerHTML = '<p class="text-sm text-muted" style="padding:0 20px;">Erro ao carregar servicos.</p>';
        console.error(err);
    }
}

async function renderHomeProducts() {
    const container = document.getElementById('home-products');
    if (!container) return;
    container.innerHTML = skeletonProductCards(4);
    try {
        const products = await getProducts();
        if (typeof homeProducts !== 'undefined') homeProducts = products;
        if (products.length === 0) {
            container.innerHTML = '<p class="text-sm text-muted" style="padding:0 20px;">Nenhum produto disponivel.</p>';
            return;
        }
        container.innerHTML = '';
        container.classList.add('stagger-in');
        container.innerHTML = products.slice(0, 6).map(p => `
            <div class="product-card" style="cursor:pointer;" onclick="openItemDetail('produto','${p.id}')">
                <div style="position:relative;">
                    <img src="${p.image || 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=300&fit=crop'}" alt="${p.name}" class="product-card-img" loading="lazy">
                    ${isAdmin() ? `<button class="edit-badge" onclick="event.stopPropagation(); openEditModal('${p.id}','produto')" title="Editar"><i class="fas fa-pen"></i></button>` : ''}
                </div>
                <p class="product-card-name">${p.name}</p>
                <p class="product-card-price">R$ ${fmtPrice(p.price)}</p>
            </div>`).join('');
    } catch (err) {
        container.innerHTML = '<p class="text-sm text-muted" style="padding:0 20px;">Erro ao carregar produtos.</p>';
        console.error(err);
    }
}

// ========== HOME ITEM DETAIL MODAL ==========
function openItemDetail(type, id) {
    const overlay = document.getElementById('detail-overlay');
    const sheet = document.getElementById('detail-sheet');
    const content = document.getElementById('detail-content');
    if (!overlay || !sheet || !content) return;

    // Find the item from cached arrays
    let item = null;
    if (type === 'servico' && typeof homeServices !== 'undefined') {
        item = homeServices.find(s => s.id === id);
    } else if (type === 'produto' && typeof homeProducts !== 'undefined') {
        item = homeProducts.find(p => p.id === id);
    }
    if (!item) return;

    const imgSrc = item.image || (type === 'servico'
        ? 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=300&fit=crop'
        : 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=300&fit=crop');

    const isOutOfStock = type === 'produto' && item.stockType === 'quantidade' && (item.stockQuantity || 0) <= 0;

    let metaHtml = '';
    if (type === 'servico') {
        metaHtml = `
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
                <span style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-muted);">
                    <i class="far fa-clock" style="color:var(--accent);"></i> ${item.duration} min
                </span>
                ${item.prepTime ? `<span style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-muted);">
                    <i class="fas fa-hourglass-half" style="color:var(--accent);"></i> +${item.prepTime} min preparo
                </span>` : ''}
            </div>`;
    } else {
        const stockLabel = isOutOfStock ? 'Esgotado'
            : item.stockType === 'requisicao' ? 'Sob encomenda'
            : `${item.stockQuantity} em estoque`;
        const stockColor = isOutOfStock ? 'var(--danger)' : item.stockType === 'requisicao' ? 'var(--accent)' : '#4caf50';
        metaHtml = `
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
                <span style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:${stockColor};">
                    <i class="fas fa-${isOutOfStock ? 'times-circle' : item.stockType === 'requisicao' ? 'truck' : 'check-circle'}"></i> ${stockLabel}
                </span>
                ${item.deliveryTime ? `<span style="font-size:0.8rem;color:var(--text-muted);"><i class="fas fa-calendar-check"></i> ${item.deliveryTime}</span>` : ''}
            </div>`;
    }

    let actionBtn = '';
    if (type === 'servico') {
        actionBtn = `<a href="agendar.html" class="btn btn-primary btn-full btn-lg mt-4" style="border-radius:14px;"><i class="fas fa-calendar-plus"></i> Agendar agora</a>`;
    } else if (isOutOfStock) {
        actionBtn = `<a href="catalogo.html#produtos" class="btn btn-primary btn-full btn-lg mt-4" style="border-radius:14px;"><i class="fas fa-bell"></i> Me avise quando disponivel</a>`;
    } else {
        actionBtn = `<a href="catalogo.html#produtos" class="btn btn-primary btn-full btn-lg mt-4" style="border-radius:14px;"><i class="fas fa-shopping-bag"></i> Solicitar produto</a>`;
    }

    content.innerHTML = `
        <div style="position:relative;">
            <img src="${imgSrc}" alt="${item.name}"
                style="width:100%;height:220px;object-fit:cover;display:block;"
                onerror="this.src='https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=220&fit=crop'">
            <div style="position:absolute;inset:0;background:linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.6));"></div>
        </div>
        <div style="padding:20px 20px 28px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;">
                <h2 style="font-size:1.2rem;font-weight:800;color:var(--text-dark);line-height:1.3;">${item.name}</h2>
                <span style="font-size:1.2rem;font-weight:800;color:var(--accent);white-space:nowrap;">R$ ${fmtPrice(item.price)}</span>
            </div>
            ${metaHtml}
            ${item.description ? `<p style="font-size:0.875rem;color:var(--text-muted);line-height:1.6;margin-bottom:16px;">${item.description}</p>` : ''}
            ${actionBtn}
        </div>`;

    openModal('detail-overlay', 'detail-sheet');
}

function closeDetailModal() {
    closeModal('detail-overlay', 'detail-sheet');
}

// ========== ADMIN IMAGE EDIT (from Home) ==========
async function editServiceImage(serviceId) {
    try {
        showToast('Selecione uma imagem...', '');
        const url = await pickAndUploadImage(`services/${serviceId}_${Date.now()}`);
        await updateService(serviceId, { image: url });
        showToast('Imagem atualizada!', 'success');
        renderHomeServices();
    } catch (err) {
        if (err.message !== 'Nenhum arquivo selecionado') showToast('Erro ao enviar imagem', 'error');
    }
}

async function editProductImage(productId) {
    try {
        showToast('Selecione uma imagem...', '');
        const url = await pickAndUploadImage(`products/${productId}_${Date.now()}`);
        await updateProduct(productId, { image: url });
        showToast('Imagem atualizada!', 'success');
        renderHomeProducts();
    } catch (err) {
        if (err.message !== 'Nenhum arquivo selecionado') showToast('Erro ao enviar imagem', 'error');
    }
}

async function editHeroBackground() {
    try {
        showToast('Selecione uma imagem de fundo...', '');
        const url = await pickAndUploadImage(`site/hero_${Date.now()}`);
        await updateSiteConfig({ heroBackground: url });
        showToast('Fundo atualizado!', 'success');
        applyHeroConfig();
    } catch (err) {
        if (err.message !== 'Nenhum arquivo selecionado') showToast('Erro ao enviar imagem', 'error');
    }
}

async function applyHeroConfig() {
    try {
        const config = await getSiteConfig();
        const banner = document.querySelector('.hero-banner');
        if (banner && config.heroBackground) {
            banner.style.backgroundImage = `linear-gradient(135deg, rgba(196,168,130,0.85), rgba(139,106,71,0.85)), url('${config.heroBackground}')`;
            banner.style.backgroundSize = 'cover';
            banner.style.backgroundPosition = 'center';
        }
        const titleEl = document.getElementById('hero-title');
        const subtitleEl = document.getElementById('hero-subtitle');
        const tagEl = document.getElementById('hero-tag');
        if (titleEl && config.heroTitle) titleEl.textContent = config.heroTitle;
        if (subtitleEl && config.heroSubtitle) subtitleEl.textContent = config.heroSubtitle;
        if (tagEl && config.heroTag) tagEl.textContent = config.heroTag;
    } catch (err) {
        console.error('Error loading site config:', err);
    }
}

async function editHeroText(field) {
    const config = await getSiteConfig();
    const labels = { heroTitle: 'Titulo do Banner', heroSubtitle: 'Subtitulo do Banner', heroTag: 'Tag do Banner' };
    const current = config[field] || '';
    const newVal = prompt(labels[field] || field, current);
    if (newVal !== null && newVal !== current) {
        await updateSiteConfig({ [field]: newVal });
        showToast('Texto atualizado!', 'success');
        applyHeroConfig();
    }
}

// ========== LOGO CONFIG (all pages) ==========
async function applyLogoConfig() {
    try {
        const config = await getSiteConfig();
        const logoEl = document.querySelector('.header-logo');
        if (!logoEl) return;
        if (config.logoImage) {
            logoEl.innerHTML = `<img src="${config.logoImage}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
        } else if (config.logoText) {
            let style = '';
            if (config.logoFontSize === 'pequeno') style += 'font-size:0.7rem;';
            else if (config.logoFontSize === 'grande') style += 'font-size:1.3rem;';
            else style += 'font-size:1rem;';
            if (config.logoFontStyle === 'negrito') style += 'font-weight:800;';
            else if (config.logoFontStyle === 'italico') style += 'font-style:italic;';
            logoEl.innerHTML = `<span style="${style}">${config.logoText}</span>`;
        }
    } catch(e) { console.error('Logo config error:', e); }
}

// ========== PROMOTION RENDER FOR CLIENT ==========
async function renderClientPromotions(containerEl, clientEmail) {
    if (!containerEl || !clientEmail) return;
    try {
        const promotions = await getPromotions();
        if (promotions.length === 0) { containerEl.innerHTML = ''; return; }

        let html = '';
        for (const promo of promotions) {
            const count = await getClientPromotionProgress(clientEmail, promo.targetId, promo.type);
            const required = promo.requiredCount || 5;
            const remaining = Math.max(0, required - (count % (required + (promo.freeCount || 1))));
            const progress = Math.min(count % (required + (promo.freeCount || 1)), required);
            const pct = Math.round((progress / required) * 100);
            const earned = Math.floor(count / (required + (promo.freeCount || 1)));

            html += `
                <div class="promo-card fade-in">
                    <div class="promo-header">
                        <div class="promo-icon"><i class="fas fa-gift"></i></div>
                        <div class="promo-info">
                            <h4 class="promo-title">${promo.targetName}</h4>
                            <p class="promo-desc">${promo.description || `Agende ${required}x e ganhe ${promo.freeCount || 1} gratis!`}</p>
                        </div>
                    </div>
                    <div class="promo-progress">
                        <div class="promo-bar">
                            <div class="promo-bar-fill" style="width: ${pct}%"></div>
                        </div>
                        <div class="promo-stats">
                            <span>${progress} de ${required}</span>
                            <span>${remaining > 0 ? `Falta${remaining > 1 ? 'm' : ''} ${remaining}` : 'Resgate disponivel!'}</span>
                        </div>
                    </div>
                    ${earned > 0 ? `<div class="promo-earned"><i class="fas fa-trophy"></i> ${earned} gratis resgatado${earned > 1 ? 's' : ''}!</div>` : ''}
                </div>`;
        }
        containerEl.innerHTML = html;
    } catch (err) {
        console.error('Error rendering promotions:', err);
    }
}

// ========== BUTTON LOADING STATE ==========
function btnLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
        if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
    }
}
