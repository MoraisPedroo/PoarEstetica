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

async function initAuth() {
    if (authReady) return currentUserProfile;
    return authReadyPromise;
}

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

function escapeHtml(v) {
    if (v === null || v === undefined) return '';
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
const esc = escapeHtml;

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
    el.setAttribute('inputmode', 'tel');
    el.setAttribute('autocomplete', 'tel');
    el.setAttribute('maxlength', '16');

    function formatDigits(d) {
        if (!d) return '';
        if (d.length <= 2) return `(${d}`;
        if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
        if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
        return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
    }

    el.addEventListener('input', function (e) {
        const isDeleting = e.inputType && e.inputType.startsWith('delete');
        const raw = e.target.value;
        const digits = raw.replace(/\D/g, '').slice(0, 11);

        let finalDigits = digits;
        if (isDeleting && /[\s\-\)]$/.test(raw) && digits.length > 0) {
            const wouldBe = formatDigits(digits);
            if (wouldBe.length > raw.length) {
                finalDigits = digits.slice(0, -1);
            }
        }

        const formatted = formatDigits(finalDigits);
        if (formatted !== raw) {
            const cursorAtEnd = e.target.selectionStart === raw.length;
            e.target.value = formatted;
            if (cursorAtEnd) {
                e.target.setSelectionRange(formatted.length, formatted.length);
            }
        }
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
function getUnavailableReason(date, timeStr, service, bookings, allServices, availability) {
    const slotStart = timeToMin(timeStr);
    const slotEnd = slotStart + service.duration + (service.prepTime || 0);

    const now = new Date();
    const todayStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
    if (date === todayStr) {
        const nowMin = now.getHours() * 60 + now.getMinutes();
        if (slotStart <= nowMin + 30) {
            return 'Horário já passou — escolha um horário futuro';
        }
    }

    let dayEndMin = 24 * 60 - 1;
    if (availability) {
        const dow = new Date(date + 'T12:00:00').getDay();
        const cfg = availability[String(dow)];
        if (cfg && cfg.enabled && cfg.endTime) {
            dayEndMin = timeToMin(cfg.endTime);
        }
    }

    if (slotEnd > dayEndMin) {
        return `Serviço de ${service.duration}min não cabe neste horário (termina após o expediente)`;
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

function isSlotFullyBlocked(date, timeStr, bookings, allServices, availability) {
    for (const svc of allServices) {
        if (!getUnavailableReason(date, timeStr, svc, bookings, allServices, availability)) {
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
            container.innerHTML = '<p class="text-sm text-muted" style="padding:0 20px;">Nenhum serviço disponivel.</p>';
            return;
        }
        container.innerHTML = '';
        container.classList.add('stagger-in');
        container.innerHTML = services.slice(0, 6).map(s => `
            <div class="service-card" style="cursor:pointer;" onclick="openItemDetail('servico','${esc(s.id)}')">
                <div style="position:relative;">
                    <img src="${esc(s.image || 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=300&fit=crop')}" alt="${esc(s.name)}" class="service-card-img" loading="lazy">
                    ${isAdmin() ? `<button class="edit-badge" onclick="event.stopPropagation(); openEditModal('${esc(s.id)}','servico')" title="Editar"><i class="fas fa-pen"></i></button>` : ''}
                </div>
                <div class="service-card-body">
                    <h4 class="service-card-name">${esc(s.name)}</h4>
                    <p class="service-card-meta"><i class="far fa-clock"></i> ${esc(s.duration)} min</p>
                    <p class="service-card-price">R$ ${fmtPrice(s.price)}</p>
                </div>
            </div>`).join('');
    } catch (err) {
        container.innerHTML = '<p class="text-sm text-muted" style="padding:0 20px;">Erro ao carregar serviços.</p>';
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
            <div class="product-card" style="cursor:pointer;" onclick="openItemDetail('produto','${esc(p.id)}')">
                <div style="position:relative;">
                    <img src="${esc(p.image || 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=300&fit=crop')}" alt="${esc(p.name)}" class="product-card-img" loading="lazy">
                    ${isAdmin() ? `<button class="edit-badge" onclick="event.stopPropagation(); openEditModal('${esc(p.id)}','produto')" title="Editar"><i class="fas fa-pen"></i></button>` : ''}
                </div>
                <p class="product-card-name">${esc(p.name)}</p>
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

    // Product is "On Order" (sob encomenda) if requisição OR quantidade with 0 stock
    const onOrder = type === 'produto' && !(item.stockType === 'quantidade' && (item.stockQuantity || 0) > 0);

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
        const stockLabel = onOrder ? 'Sob encomenda' : 'Em estoque';
        const stockColor = onOrder ? '#f59e0b' : '#4caf50';
        const stockIcon = onOrder ? 'truck' : 'check-circle';
        metaHtml = `
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
                <span style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:${stockColor};font-weight:600;">
                    <i class="fas fa-${stockIcon}"></i> ${stockLabel}
                </span>
                ${item.deliveryTime && onOrder ? `<span style="font-size:0.8rem;color:var(--text-muted);"><i class="fas fa-calendar-check"></i> ${item.deliveryTime}</span>` : ''}
            </div>`;
    }

    let actionBtn = '';
    let extraNote = '';
    if (type === 'servico') {
        actionBtn = `<a href="agendar.html?service=${encodeURIComponent(item.id)}" class="btn btn-primary btn-full btn-lg mt-4" style="border-radius:14px;"><i class="fas fa-arrow-right"></i> Ver disponibilidade e agendar</a>`;
        extraNote = `<p class="text-xs text-muted mt-8" style="text-align:center;"><i class="fas fa-info-circle"></i> Você será levado direto à página de agendamento deste serviço</p>`;
    } else if (onOrder) {
        actionBtn = `<a href="catalogo.html#produtos" class="btn btn-primary btn-full btn-lg mt-4" style="border-radius:14px;background:linear-gradient(135deg,#f59e0b,#f97316);border:none;"><i class="fas fa-arrow-right"></i> Solicitar sob encomenda</a>`;
        extraNote = `<p class="text-xs text-muted mt-8" style="text-align:center;"><i class="fas fa-info-circle"></i> Produto fora de estoque — a Poar entra em contato quando chegar</p>`;
    } else {
        actionBtn = `<a href="catalogo.html#produtos" class="btn btn-primary btn-full btn-lg mt-4" style="border-radius:14px;"><i class="fas fa-arrow-right"></i> Ver no catálogo e solicitar</a>`;
        extraNote = `<p class="text-xs text-muted mt-8" style="text-align:center;"><i class="fas fa-info-circle"></i> Você será levado para o catálogo para concluir o pedido</p>`;
    }

    content.innerHTML = `
        <div style="position:relative;">
            <img src="${esc(imgSrc)}" alt="${esc(item.name)}"
                style="width:100%;height:220px;object-fit:cover;display:block;"
                onerror="this.src='https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=220&fit=crop'">
            <div style="position:absolute;inset:0;background:linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.6));"></div>
        </div>
        <div style="padding:20px 20px 28px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;">
                <h2 style="font-size:1.2rem;font-weight:800;color:var(--text-dark);line-height:1.3;">${esc(item.name)}</h2>
                <span style="font-size:1.2rem;font-weight:800;color:var(--accent);white-space:nowrap;">R$ ${fmtPrice(item.price)}</span>
            </div>
            ${metaHtml}
            ${item.description ? `<p style="font-size:0.875rem;color:var(--text-muted);line-height:1.6;margin-bottom:16px;">${esc(item.description)}</p>` : ''}
            ${actionBtn}
            ${extraNote}
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
        const titleEl = document.querySelector('.header-title');
        const subtitleEl = document.querySelector('.header-subtitle');

        // Apply logo (icon/image)
        if (logoEl) {
            const existingBadge = logoEl.querySelector('.header-logo-edit-badge');
            if (config.logoImage) {
                logoEl.innerHTML = `<img src="${config.logoImage}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
            } else {
                let style = '';
                if (config.logoFontSize === 'small' || config.logoFontSize === 'pequeno') style += 'font-size:0.85rem;';
                else if (config.logoFontSize === 'large' || config.logoFontSize === 'grande') style += 'font-size:1.5rem;';
                else style += 'font-size:1.1rem;';
                if (config.logoFontStyle === 'bold' || config.logoFontStyle === 'negrito') style += 'font-weight:800;';
                else if (config.logoFontStyle === 'italic' || config.logoFontStyle === 'italico') style += 'font-style:italic;';
                const text = config.logoText || 'P';
                logoEl.innerHTML = `<span style="${style}">${text}</span>`;
            }
            if (existingBadge) logoEl.appendChild(existingBadge);
        }

        // Apply title + subtitle text (the "Poar Estética" branding)
        if (titleEl && config.brandTitle) titleEl.textContent = config.brandTitle;
        if (subtitleEl && config.brandSubtitle) subtitleEl.textContent = config.brandSubtitle;

        // Apply WhatsApp floating button: href + aria-label
        applyWhatsappContact(config);

        // If admin, ensure the edit badge is present on the logo
        if (typeof isAdmin === 'function' && isAdmin() && logoEl) {
            addAdminLogoEditBadge(logoEl);
        }
    } catch(e) { console.error('Logo config error:', e); }
}

// ========== WHATSAPP CONTACT (siteConfig) ==========
function applyWhatsappContact(config) {
    const fab = document.querySelector('.fab-whatsapp');
    if (!fab) return;
    const digits = (config.whatsappNumber || '').replace(/\D/g, '');
    const name = config.whatsappName || 'Poar';
    if (digits.length >= 10) {
        fab.href = `https://wa.me/${digits.startsWith('55') ? digits : '55' + digits}`;
        fab.setAttribute('aria-label', `WhatsApp — ${name}`);
        fab.title = `Falar com ${name} no WhatsApp`;
    } else {
        // No number configured: hide the floating button.
        fab.style.display = 'none';
    }
}

// ========== ADMIN LOGO EDIT (global) ==========
function addAdminLogoEditBadge(el) {
    if (!el || el.querySelector('.header-logo-edit-badge')) return;
    el.style.position = 'relative';
    const badge = document.createElement('span');
    badge.className = 'header-logo-edit-badge';
    badge.title = 'Editar logo e branding';
    badge.innerHTML = '<i class="fas fa-pen"></i>';
    badge.style.cssText = 'position:absolute;bottom:-4px;right:-4px;background:var(--accent,#e91e63);color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:0.65rem;cursor:pointer;border:2px solid var(--bg,#fff);z-index:2;transition:transform 0.15s;';
    badge.onmouseover = () => badge.style.transform = 'scale(1.15)';
    badge.onmouseout = () => badge.style.transform = 'scale(1)';
    badge.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openGlobalLogoEditModal();
    };
    el.appendChild(badge);
}

function ensureLogoEditModalInjected() {
    if (document.getElementById('global-logoedit-overlay')) return;
    const modalHtml = `
        <div class="modal-overlay" id="global-logoedit-overlay" onclick="closeGlobalLogoEditModal()"></div>
        <div class="bottom-sheet" id="global-logoedit-sheet">
            <div class="bottom-sheet-handle"></div>
            <div class="flex items-center justify-between mb-16">
                <h3 class="bottom-sheet-title" style="margin-bottom:0;"><i class="fas fa-paint-brush" style="color:var(--accent);"></i> Editar Logo e Branding</h3>
                <button class="btn btn-ghost btn-sm" onclick="closeGlobalLogoEditModal()" style="color:var(--text-muted);"><i class="fas fa-times"></i></button>
            </div>
            <div style="text-align:center;margin-bottom:16px;">
                <div id="global-logo-edit-preview" style="width:80px;height:80px;border-radius:16px;background:var(--bg-card,#fff);border:2px solid var(--border-light,#eee);display:inline-flex;align-items:center;justify-content:center;margin:0 auto 8px;font-size:1.6rem;font-weight:700;color:var(--accent,#e91e63);overflow:hidden;">P</div>
                <div><strong id="global-brand-preview-title" style="font-size:1.05rem;color:var(--text-dark);">Poar</strong> <span id="global-brand-preview-subtitle" style="font-size:0.85rem;color:var(--text-muted);">Estética</span></div>
            </div>
            <div style="text-align:left;display:flex;flex-direction:column;gap:14px;">
                <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label"><i class="fas fa-image"></i> Imagem do ícone (opcional)</label>
                    <button class="btn btn-outline btn-sm btn-full" id="btn-upload-global-logo" onclick="uploadGlobalLogoImage()">
                        <i class="fas fa-upload"></i> Enviar imagem
                    </button>
                    <input type="hidden" id="global-logo-edit-image-url">
                    <button class="btn btn-ghost btn-sm mt-8 hidden" id="btn-remove-global-logo-img" onclick="removeGlobalLogoImage()" style="color:var(--danger,red);font-size:0.8rem;">
                        <i class="fas fa-trash"></i> Remover imagem
                    </button>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label"><i class="fas fa-font"></i> Letra/texto do ícone</label>
                    <input type="text" class="form-control" id="global-logo-edit-text" placeholder="Ex: P" maxlength="10">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label">Tamanho</label>
                        <select class="form-control" id="global-logo-edit-fontsize">
                            <option value="small">Pequeno</option>
                            <option value="medium" selected>Médio</option>
                            <option value="large">Grande</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label">Estilo</label>
                        <select class="form-control" id="global-logo-edit-fontstyle">
                            <option value="normal">Normal</option>
                            <option value="bold">Negrito</option>
                            <option value="italic">Itálico</option>
                        </select>
                    </div>
                </div>
                <hr style="border:none;border-top:1px solid var(--border-light);margin:4px 0;">
                <p class="text-xs fw-600 text-muted" style="text-transform:uppercase;letter-spacing:0.04em;"><i class="fas fa-tag" style="color:var(--accent);"></i> Texto da marca</p>
                <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label">Nome principal</label>
                    <input type="text" class="form-control" id="global-brand-title" placeholder="Poar" maxlength="30">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label">Complemento</label>
                    <input type="text" class="form-control" id="global-brand-subtitle" placeholder="Estética" maxlength="40">
                </div>

                <button class="btn btn-primary btn-full btn-lg mt-8" id="btn-save-global-logo" onclick="saveGlobalLogoConfig()">
                    <i class="fas fa-save"></i> Salvar
                </button>
            </div>
        </div>`;
    const wrap = document.createElement('div');
    wrap.innerHTML = modalHtml;
    document.body.appendChild(wrap);

    // Live preview listeners
    document.getElementById('global-logo-edit-text').addEventListener('input', updateGlobalLogoPreview);
    document.getElementById('global-logo-edit-fontsize').addEventListener('change', updateGlobalLogoPreview);
    document.getElementById('global-logo-edit-fontstyle').addEventListener('change', updateGlobalLogoPreview);
    document.getElementById('global-brand-title').addEventListener('input', e => {
        document.getElementById('global-brand-preview-title').textContent = e.target.value || 'Poar';
    });
    document.getElementById('global-brand-subtitle').addEventListener('input', e => {
        document.getElementById('global-brand-preview-subtitle').textContent = e.target.value || 'Estética';
    });
}

function updateGlobalLogoPreview() {
    const preview = document.getElementById('global-logo-edit-preview');
    if (!preview) return;
    const imgUrl = document.getElementById('global-logo-edit-image-url').value;
    if (imgUrl) {
        preview.innerHTML = `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
        document.getElementById('btn-remove-global-logo-img').classList.remove('hidden');
        return;
    }
    const text = document.getElementById('global-logo-edit-text').value || 'P';
    const size = document.getElementById('global-logo-edit-fontsize').value;
    const style = document.getElementById('global-logo-edit-fontstyle').value;
    let css = '';
    if (size === 'small') css += 'font-size:1.1rem;';
    else if (size === 'large') css += 'font-size:2.1rem;';
    else css += 'font-size:1.6rem;';
    if (style === 'bold') css += 'font-weight:800;';
    else if (style === 'italic') css += 'font-style:italic;';
    preview.innerHTML = `<span style="${css}">${text}</span>`;
}

async function openGlobalLogoEditModal() {
    ensureLogoEditModalInjected();
    try {
        const config = await getSiteConfig();
        document.getElementById('global-logo-edit-image-url').value = config.logoImage || '';
        document.getElementById('global-logo-edit-text').value = config.logoText || 'P';
        document.getElementById('global-logo-edit-fontsize').value = config.logoFontSize || 'medium';
        document.getElementById('global-logo-edit-fontstyle').value = config.logoFontStyle || 'normal';
        document.getElementById('global-brand-title').value = config.brandTitle || 'Poar';
        document.getElementById('global-brand-subtitle').value = config.brandSubtitle || 'Estética';
        const removeBtn = document.getElementById('btn-remove-global-logo-img');
        if (config.logoImage) removeBtn.classList.remove('hidden');
        else removeBtn.classList.add('hidden');
        updateGlobalLogoPreview();
        document.getElementById('global-brand-preview-title').textContent = config.brandTitle || 'Poar';
        document.getElementById('global-brand-preview-subtitle').textContent = config.brandSubtitle || 'Estética';
    } catch(e) { console.error(e); }
    openModal('global-logoedit-overlay', 'global-logoedit-sheet');
}

function closeGlobalLogoEditModal() {
    closeModal('global-logoedit-overlay', 'global-logoedit-sheet');
}

async function uploadGlobalLogoImage() {
    try {
        showToast('Selecione uma imagem...', '');
        const url = await pickAndUploadImage(`siteConfig/logo_${Date.now()}`);
        document.getElementById('global-logo-edit-image-url').value = url;
        document.getElementById('btn-remove-global-logo-img').classList.remove('hidden');
        updateGlobalLogoPreview();
        showToast('Imagem carregada!', 'success');
    } catch(e) {
        if (e.message !== 'Nenhum arquivo selecionado') showToast('Erro ao enviar imagem', 'error');
    }
}

function removeGlobalLogoImage() {
    document.getElementById('global-logo-edit-image-url').value = '';
    document.getElementById('btn-remove-global-logo-img').classList.add('hidden');
    updateGlobalLogoPreview();
}

async function saveGlobalLogoConfig() {
    const btn = document.getElementById('btn-save-global-logo');
    btnLoading(btn, true);
    try {
        const data = {
            logoImage: document.getElementById('global-logo-edit-image-url').value || '',
            logoText: document.getElementById('global-logo-edit-text').value.trim() || 'P',
            logoFontSize: document.getElementById('global-logo-edit-fontsize').value,
            logoFontStyle: document.getElementById('global-logo-edit-fontstyle').value,
            brandTitle: document.getElementById('global-brand-title').value.trim() || 'Poar',
            brandSubtitle: document.getElementById('global-brand-subtitle').value.trim() || 'Estética'
        };
        await updateSiteConfig(data);
        await applyLogoConfig();
        closeGlobalLogoEditModal();
        showToast('Logo e branding atualizados!', 'success');
    } catch(e) {
        showToast('Erro ao salvar: ' + e.message, 'error');
    } finally {
        btnLoading(btn, false);
    }
}

// ========== PROMOTION RENDER FOR CLIENT ==========
async function renderClientPromotions(containerEl, clientEmail) {
    if (!containerEl || !clientEmail) return;
    try {
        const promotions = await getPromotions();
        if (promotions.length === 0) { containerEl.innerHTML = ''; return; }

        // Fetch existing redemption requests for this client to know which are pending/done
        const redemptionsSnap = await db.collection('promotionRedemptions')
            .where('clientEmail', '==', clientEmail)
            .get();
        const redemptions = redemptionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        let html = '';
        for (const promo of promotions) {
            // Use new field names (requiredTargetId/Name/Type) with fallback to legacy names
            const reqTargetId = promo.requiredTargetId || promo.targetId;
            const reqType = promo.requiredType || promo.type;
            const reqName = promo.requiredTargetName || promo.targetName || 'Item';
            const rewName = promo.rewardTargetName || reqName;
            const required = promo.requiredCount || 5;
            const freeCount = promo.freeCount || 1;

            if (!reqTargetId) continue; // skip invalid promos

            const count = await getClientPromotionProgress(clientEmail, reqTargetId, reqType);

            // Has this client already requested a redemption that is still pending/scheduled?
            const pendingRedemption = redemptions.find(r =>
                r.promotionId === promo.id && (r.status === 'pendente' || r.status === 'agendado')
            );

            const cyclesEarned = Math.floor(count / required);
            // Only pending/agendado/concluido redemptions count against earned cycles
            const redemptionsClaimed = redemptions.filter(r =>
                r.promotionId === promo.id && r.status !== 'cancelado'
            ).length;
            const earnedNotClaimed = Math.max(0, cyclesEarned - redemptionsClaimed);
            const progress = Math.min(count - (redemptionsClaimed * required), required);
            const pct = Math.round((progress / required) * 100);
            const remaining = Math.max(0, required - progress);
            const canRedeem = earnedNotClaimed > 0 && !pendingRedemption;

            const desc = promo.description || `Agende ${required}x ${reqName} e ganhe ${freeCount}x ${rewName} gratis!`;

            html += `
                <div class="promo-card fade-in">
                    <div class="promo-header">
                        <div class="promo-icon"><i class="fas fa-gift"></i></div>
                        <div class="promo-info">
                            <h4 class="promo-title">${esc(reqName)}</h4>
                            <p class="promo-desc">${esc(desc)}</p>
                        </div>
                    </div>
                    <div class="promo-progress">
                        <div class="promo-bar">
                            <div class="promo-bar-fill" style="width: ${pct}%"></div>
                        </div>
                        <div class="promo-stats">
                            <span>${progress} de ${required}</span>
                            <span>${canRedeem ? '🎉 Resgate disponível!' : remaining > 0 ? `Falta${remaining > 1 ? 'm' : ''} ${remaining}` : 'Completo!'}</span>
                        </div>
                    </div>
                    ${pendingRedemption ? `
                        <div class="promo-earned" style="background:linear-gradient(135deg,#fef3c7,#fde68a);color:#92400e;">
                            <i class="fas fa-hourglass-half"></i> Aguardando Poar agendar seu brinde!
                        </div>` : ''}
                    ${canRedeem ? `
                        <button class="btn btn-primary btn-full mt-12" onclick="redeemPromotion('${esc(promo.id)}')" style="background:linear-gradient(135deg,#f59e0b,#f97316);border:none;">
                            <i class="fas fa-trophy"></i> Resgatar ${freeCount}x ${esc(rewName)}!
                        </button>` : ''}
                </div>`;
        }
        containerEl.innerHTML = html;
    } catch (err) {
        console.error('Error rendering promotions:', err);
        containerEl.innerHTML = '<p class="text-sm text-muted text-center">Erro ao carregar promoc&otilde;es.</p>';
    }
}

// ========== PROMOTION REDEMPTION ==========
async function redeemPromotion(promotionId) {
    const user = getProfile();
    if (!user) { showToast('Faça login primeiro', 'error'); return; }
    if (!user.phone) { showToast('Adicione seu WhatsApp no perfil para resgatar', 'error'); return; }

    try {
        // Fetch the promotion
        const promoDoc = await db.collection('promotions').doc(promotionId).get();
        if (!promoDoc.exists) { showToast('Promoção não encontrada', 'error'); return; }
        const promo = { id: promoDoc.id, ...promoDoc.data() };

        // Create redemption request
        await db.collection('promotionRedemptions').add({
            promotionId: promo.id,
            promotionDesc: promo.description || '',
            requiredTargetName: promo.requiredTargetName || promo.targetName || '',
            rewardTargetId: promo.rewardTargetId || '',
            rewardTargetName: promo.rewardTargetName || '',
            rewardType: promo.rewardType || 'servico',
            freeCount: promo.freeCount || 1,
            clientEmail: user.email,
            clientName: user.name || '',
            clientPhone: user.phone,
            clientUid: user.uid || '',
            status: 'pendente',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Show success message to client
        showRedemptionSuccessModal(promo);

        // Send WhatsApp to admin (Poar)
        const adminMsg = `🎁 *NOVA PROMOÇÃO RESGATADA!*\n\nCliente: ${user.name || user.email}\nWhatsApp: ${user.phone}\n\nPromoção: ${promo.description || promo.requiredTargetName}\nBrinde: ${promo.freeCount || 1}x ${promo.rewardTargetName}\n\nEntre em contato para agendar o brinde do cliente.`;
        // Admin phone may not exist, but try sending to client confirmation
        const clientMsg = `🎉 *Parabéns ${user.name || 'cliente'}!*\n\nVocê completou a promoção "${promo.description || promo.requiredTargetName}" e ganhou ${promo.freeCount || 1}x ${promo.rewardTargetName}!\n\nA Poar Estética entrará em contato em breve para agendar e confirmar o dia do seu brinde. 💕`;
        if (typeof sendWhatsApp === 'function') {
            sendWhatsApp(user.phone, clientMsg).catch(err => console.error('WAHA error:', err));
        }

        // Reload promotions view
        const container = document.getElementById('profile-promotions-inner') || document.getElementById('profile-promotions');
        if (container) renderClientPromotions(container, user.email);
    } catch(e) {
        showToast('Erro ao resgatar: ' + e.message, 'error');
    }
}

function showRedemptionSuccessModal(promo) {
    const rewName = promo.rewardTargetName || 'brinde';
    const freeCount = promo.freeCount || 1;
    // Use a simple toast + alert combo for clarity
    showToast('🎉 Promoção resgatada! Aguarde contato da Poar.', 'success');
    setTimeout(() => {
        alert(`🎁 Parabéns!\n\nVocê ganhou ${freeCount}x ${rewName}!\n\nUma mensagem foi enviada para a Poar Estética e em breve ela entrará em contato no seu WhatsApp para agendar e confirmar o dia do seu brinde. 💕`);
    }, 300);
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
