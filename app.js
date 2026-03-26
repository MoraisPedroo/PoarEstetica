/* ============================================
   POAR ESTÉTICA - Lógica Principal
   localStorage como banco de dados
   ============================================ */

// ========== DADOS ==========
function getServices() {
    return JSON.parse(localStorage.getItem('poar_services') || '[]');
}
function getProducts() {
    return JSON.parse(localStorage.getItem('poar_products') || '[]');
}
function getBookings() {
    return JSON.parse(localStorage.getItem('poar_bookings') || '[]');
}
function getUsers() {
    return JSON.parse(localStorage.getItem('poar_users') || '[]');
}
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('poar_current_user') || 'null');
}

// ========== SEED (dados de exemplo) ==========
function seedDemoData() {
    if (getServices().length === 0) {
        const services = [
            { id: 'svc1', name: 'Limpeza de Pele', description: 'Limpeza profunda com extração e hidratação.', price: 120, duration: 60, prepTime: 15, image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=300&fit=crop' },
            { id: 'svc2', name: 'Massagem Relaxante', description: 'Massagem corporal com óleos essenciais.', price: 150, duration: 50, prepTime: 10, image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop' },
            { id: 'svc3', name: 'Peeling Facial', description: 'Renovação celular com ácidos profissionais.', price: 180, duration: 45, prepTime: 20, image: 'https://images.unsplash.com/photo-1552693673-1bf958298935?w=400&h=300&fit=crop' },
            { id: 'svc4', name: 'Design de Sobrancelhas', description: 'Modelagem personalizada com henna ou tintura.', price: 60, duration: 30, prepTime: 5, image: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&h=300&fit=crop' },
            { id: 'svc5', name: 'Drenagem Linfática', description: 'Técnica suave para redução de inchaço e retenção.', price: 140, duration: 60, prepTime: 10, image: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=300&fit=crop' }
        ];
        localStorage.setItem('poar_services', JSON.stringify(services));
    }
    if (getProducts().length === 0) {
        const products = [
            { id: 'prod1', name: 'Protetor Solar FPS50', description: 'Proteção solar de alta performance, toque seco.', price: 89.90, image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=300&fit=crop' },
            { id: 'prod2', name: 'Sérum Vitamina C', description: 'Antioxidante potente para luminosidade.', price: 120, image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&h=300&fit=crop' },
            { id: 'prod3', name: 'Hidratante Facial', description: 'Hidratação profunda com ácido hialurônico.', price: 75, image: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=300&fit=crop' },
            { id: 'prod4', name: 'Água Micelar', description: 'Limpeza suave e eficaz para todos os tipos de pele.', price: 45, image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=300&fit=crop' }
        ];
        localStorage.setItem('poar_products', JSON.stringify(products));
    }
    // Admin padrão (e-mails com @poar.com são gestão)
    const users = getUsers();
    if (!users.find(u => u.email === 'admin@poar.com')) {
        users.push({ id: 'admin', email: 'admin@poar.com', password: 'admin', role: 'gestao', name: 'Administradora' });
        localStorage.setItem('poar_users', JSON.stringify(users));
    }
}
seedDemoData();

// ========== HOME RENDERS ==========
function renderHomeServices() {
    const container = document.getElementById('home-services');
    if (!container) return;
    const services = getServices().slice(0, 6);
    if (services.length === 0) {
        container.innerHTML = '<p class="text-sm text-muted" style="padding: 0 20px;">Nenhum serviço disponível.</p>';
        return;
    }
    container.innerHTML = services.map(s => `
        <a href="catalogo.html" class="service-card">
            <img src="${s.image || placeholderImg('servico')}" alt="${s.name}" class="service-card-img" loading="lazy">
            <div class="service-card-body">
                <h4 class="service-card-name">${s.name}</h4>
                <p class="service-card-meta"><i class="far fa-clock"></i> ${s.duration} min</p>
                <p class="service-card-price">R$ ${fmtPrice(s.price)}</p>
            </div>
        </a>`).join('');
}

function renderHomeProducts() {
    const container = document.getElementById('home-products');
    if (!container) return;
    const products = getProducts().slice(0, 6);
    if (products.length === 0) {
        container.innerHTML = '<p class="text-sm text-muted" style="padding: 0 20px;">Nenhum produto disponível.</p>';
        return;
    }
    container.innerHTML = products.map(p => `
        <a href="catalogo.html#produtos" class="product-card">
            <img src="${p.image || placeholderImg('produto')}" alt="${p.name}" class="product-card-img" loading="lazy">
            <p class="product-card-name">${p.name}</p>
            <p class="product-card-price">R$ ${fmtPrice(p.price)}</p>
        </a>`).join('');
}

// ========== AGENDAMENTO: Lógica de bloqueio ==========

/**
 * Retorna a razão de indisponibilidade de um serviço num horário,
 * ou null se disponível.
 */
function getUnavailableReason(date, timeStr, service, bookings, allServices) {
    const slotStart = timeToMin(timeStr);
    const slotEnd = slotStart + service.duration + (service.prepTime || 0);

    // Verifica se o serviço terminaria depois do expediente (18h)
    if (slotEnd > 18 * 60) {
        return `Serviço de ${service.duration}min não cabe neste horário (ultrapassa o expediente)`;
    }

    for (const b of bookings.filter(b => b.date === date)) {
        const bStart = timeToMin(b.time);
        const bSvc = allServices.find(s => s.id === b.serviceId);
        const bTotal = (b.duration || 0) + (b.prepTime || (bSvc ? bSvc.prepTime : 0) || 0);
        const bEnd = bStart + bTotal;

        // Verifica se o novo serviço colide com algum agendamento existente
        if (slotStart < bEnd && slotEnd > bStart) {
            return `Conflito com "${b.serviceName}" agendado às ${b.time} (${b.duration}min + preparação)`;
        }
    }
    return null;
}

/**
 * Verifica se ALGUM serviço pode ser agendado neste horário
 */
function isSlotFullyBlocked(date, timeStr, bookings, allServices) {
    for (const svc of allServices) {
        if (!getUnavailableReason(date, timeStr, svc, bookings, allServices)) {
            return false;
        }
    }
    return true;
}

// ========== UTILITÁRIOS ==========
function timeToMin(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function minToTime(m) {
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function fmtPrice(v) {
    return parseFloat(v).toFixed(2).replace('.', ',');
}

function placeholderImg(type) {
    return type === 'servico'
        ? 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=300&fit=crop'
        : 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=300&fit=crop';
}

function formatDateBR(dateStr) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
}

// ========== TOAST ==========
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    const icon = type === 'success' ? '✓ ' : type === 'error' ? '✕ ' : '';
    toast.innerHTML = icon + message;
    toast.className = 'toast' + (type ? ' toast-' + type : '');
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ========== MÁSCARA TELEFONE ==========
document.addEventListener('DOMContentLoaded', () => {
    const phoneInput = document.getElementById('client-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function (e) {
            let v = e.target.value.replace(/\D/g, '').slice(0, 11);
            if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
            else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
            else if (v.length > 0) v = `(${v}`;
            e.target.value = v;
        });
    }
});

// ========== MODAL HELPERS ==========
function openModal(overlayId, sheetId) {
    document.getElementById(overlayId).classList.add('show');
    document.getElementById(sheetId).classList.add('show');
}

function closeModal(overlayId, sheetId) {
    document.getElementById(overlayId).classList.remove('show');
    document.getElementById(sheetId).classList.remove('show');
}

// ========== NAV: Atualiza link ativo no desktop-nav ==========
function updateActiveNav() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.desktop-nav .nav-link, .bottom-nav .nav-btn').forEach(el => {
        const href = el.getAttribute('href');
        if (href === page) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}
document.addEventListener('DOMContentLoaded', updateActiveNav);

// ========== AUTH HELPERS ==========
function isAdmin(email) {
    return email && email.endsWith('@poar.com');
}

function getUserDisplayName() {
    const user = getCurrentUser();
    if (!user) return null;
    return user.name || user.email.split('@')[0];
}
