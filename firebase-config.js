/* ============================================
   POAR ESTÉTICA — Firebase Configuration
   Auth + Firestore + Storage + WAHA
   ============================================ */

const firebaseConfig = {
    apiKey: "AIzaSyAbKlellw9c6LxDBP_u9vanpPcgAd2qEj8",
    authDomain: "poaresetica.firebaseapp.com",
    projectId: "poaresetica",
    storageBucket: "poaresetica.firebasestorage.app",
    messagingSenderId: "667456908542",
    appId: "1:667456908542:web:99c8a5aba113dfc921c9af",
    measurementId: "G-NVJJ8Z76G6"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();
const storage = firebase.storage();

const ADMIN_EMAIL = 'admin@poar.com';

// ========== AUTH ==========
function isAdminEmail(email) { return email === ADMIN_EMAIL; }

async function loginUser(email, password) {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return cred.user;
}

async function registerUser(email, password, name, phone) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    const role = isAdminEmail(email) ? 'gestao' : 'cliente';
    await db.collection('users').doc(uid).set({
        email, name, phone: phone || '', role,
        profileImage: '',
        phoneVerified: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return cred.user;
}

// ========== PHONE VERIFICATION (via WAHA code) ==========
// Validates a Brazilian email format (loosely).
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    // Basic RFC-lite: local@domain.tld, no spaces, at least one dot in the domain.
    const re = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    return re.test(email.trim());
}

// Generates a 6-digit numeric code as a string.
function generateVerificationCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

// Normalises a Brazilian phone string -> digits-only.
function normalisePhone(phone) {
    return (phone || '').replace(/\D/g, '');
}

async function createVerificationCode(phone, email, name) {
    console.group('[VERIF] createVerificationCode');
    console.log('input phone:', phone);
    console.log('input email:', email);
    console.log('input name:', name);

    const digits = normalisePhone(phone);
    console.log('normalised digits:', digits);

    if (!digits) {
        console.error('Telefone inválido — abortando');
        console.groupEnd();
        throw new Error('Telefone inválido');
    }
    const code = generateVerificationCode();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const payload = {
        phone: digits,
        email: (email || '').toLowerCase().trim(),
        name: name || '',
        code,
        expiresAt,
        attempts: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    console.log('writing to verificationCodes/' + digits, payload);

    try {
        await db.collection('verificationCodes').doc(digits).set(payload);
        console.log('Firestore write OK — code:', code);
        console.groupEnd();
        return code;
    } catch (err) {
        console.error('Firestore write FAILED:', err);
        console.error('error code:', err.code);
        console.error('error message:', err.message);
        console.groupEnd();
        throw err;
    }
}

// Checks a code submitted by the user. Returns { ok: true, data } or { ok: false, reason }.
async function checkVerificationCode(phone, submittedCode) {
    const digits = normalisePhone(phone);
    const ref = db.collection('verificationCodes').doc(digits);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, reason: 'Código expirado ou inexistente. Reenvie o código.' };
    const data = snap.data();

    if (Date.now() > (data.expiresAt || 0)) {
        return { ok: false, reason: 'Código expirado. Reenvie o código.' };
    }
    if ((data.attempts || 0) >= 5) {
        return { ok: false, reason: 'Muitas tentativas. Reenvie o código.' };
    }
    if (String(submittedCode).trim() !== String(data.code)) {
        await ref.update({ attempts: (data.attempts || 0) + 1 });
        const remaining = 4 - (data.attempts || 0);
        return { ok: false, reason: `Código incorreto. Restam ${remaining} tentativa${remaining === 1 ? '' : 's'}.` };
    }
    return { ok: true, data };
}

async function deleteVerificationCode(phone) {
    const digits = normalisePhone(phone);
    try { await db.collection('verificationCodes').doc(digits).delete(); }
    catch(e) { /* ignore */ }
}

async function logoutUser() { await auth.signOut(); }
function onAuthChange(cb) { return auth.onAuthStateChanged(cb); }

async function getUserProfile(uid) {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function updateUserProfile(uid, data) {
    await db.collection('users').doc(uid).update(data);
}

// ========== FIRESTORE: SERVICES ==========
async function getServices() {
    const snap = await db.collection('services').orderBy('name').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addService(data) {
    return await db.collection('services').add({
        ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function updateService(id, data) {
    await db.collection('services').doc(id).update(data);
}

async function deleteService(id) {
    await db.collection('services').doc(id).delete();
}

// ========== FIRESTORE: PRODUCTS ==========
// Product fields: name, description, price, image, stockType ('quantidade'|'requisicao'),
//   stockQuantity, stockAlert, deliveryTime
async function getProducts() {
    const snap = await db.collection('products').orderBy('name').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addProduct(data) {
    return await db.collection('products').add({
        ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function updateProduct(id, data) {
    await db.collection('products').doc(id).update(data);
}

async function deleteProduct(id) {
    await db.collection('products').doc(id).delete();
}

// ========== FIRESTORE: PRODUCT ORDERS ==========
// Fields: productId, productName, quantity, clientName, clientEmail, clientPhone, clientUid,
//   status ('pendente'|'aprovado'|'cancelado'), cancelReason, deliveryTime
async function getProductOrders() {
    const snap = await db.collection('productOrders').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getProductOrdersByClient(email) {
    // No orderBy here to avoid requiring a composite index. Sort in JS.
    const snap = await db.collection('productOrders')
        .where('clientEmail', '==', email)
        .get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return items.sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
    });
}

async function addProductOrder(data) {
    return await db.collection('productOrders').add({
        ...data, status: 'pendente',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function updateProductOrder(id, data) {
    await db.collection('productOrders').doc(id).update(data);
}

// ========== FIRESTORE: BOOKINGS ==========
async function getBookings() {
    // No orderBy chain to avoid composite index requirement. Sort in JS.
    const snap = await db.collection('bookings').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return items.sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || '')));
}

async function getBookingsByDate(date) {
    // Only use one where clause to avoid composite index requirement. Filter status in JS.
    const snap = await db.collection('bookings')
        .where('date', '==', date)
        .get();
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(b => b.status === 'pendente' || b.status === 'confirmado');
}

async function getBookingsByClient(email) {
    // No orderBy here to avoid requiring a composite index. Sort in JS.
    const snap = await db.collection('bookings')
        .where('clientEmail', '==', email)
        .get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

async function addBooking(data) {
    return await db.collection('bookings').add({
        ...data, status: 'pendente',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function updateBookingStatus(id, status, cancelReason) {
    const update = { status };
    if (cancelReason) update.cancelReason = cancelReason;
    await db.collection('bookings').doc(id).update(update);
}

async function deleteBooking(id) {
    await db.collection('bookings').doc(id).delete();
}

// ========== FIRESTORE: AVAILABILITY ==========
// Fields: enabled, period ('manha'|'tarde'|'ambos'), startTime, endTime, lunchStart, lunchEnd
async function getAvailability() {
    const snap = await db.collection('availability').get();
    const map = {};
    snap.docs.forEach(d => { map[d.id] = d.data(); });
    return map;
}

async function setAvailability(dayOfWeek, data) {
    await db.collection('availability').doc(String(dayOfWeek)).set(data, { merge: true });
}

async function getBlockedDates() {
    const snap = await db.collection('blockedDates').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addBlockedDate(dateStr, reason) {
    await db.collection('blockedDates').doc(dateStr).set({ date: dateStr, reason: reason || '' });
}

async function removeBlockedDate(dateStr) {
    await db.collection('blockedDates').doc(dateStr).delete();
}

// ========== FIRESTORE: PROMOTIONS ==========
// Fields: requiredType, requiredTargetId, requiredTargetName, requiredCount,
//   rewardType, rewardTargetId, rewardTargetName, description, active
async function getPromotions() {
    const snap = await db.collection('promotions').where('active', '==', true).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getAllPromotions() {
    const snap = await db.collection('promotions').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addPromotion(data) {
    return await db.collection('promotions').add({
        ...data, active: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function updatePromotion(id, data) {
    await db.collection('promotions').doc(id).update(data);
}

async function deletePromotion(id) {
    await db.collection('promotions').doc(id).delete();
}

async function getClientPromotionProgress(clientEmail, targetId, type) {
    // Use single where + JS filtering to avoid composite index requirements.
    if (type === 'servico') {
        const snap = await db.collection('bookings')
            .where('clientEmail', '==', clientEmail)
            .get();
        return snap.docs.filter(d => {
            const x = d.data();
            return x.serviceId === targetId && (x.status === 'confirmado' || x.status === 'pendente');
        }).length;
    }
    if (type === 'produto') {
        const snap = await db.collection('productOrders')
            .where('clientEmail', '==', clientEmail)
            .get();
        let total = 0;
        snap.docs.forEach(d => {
            const x = d.data();
            if (x.productId === targetId && (x.status === 'aprovado' || x.status === 'pendente')) {
                total += (x.quantity || 1);
            }
        });
        return total;
    }
    return 0;
}

// ========== FIRESTORE: SITE CONFIG ==========
async function getSiteConfig() {
    const doc = await db.collection('siteConfig').doc('general').get();
    return doc.exists ? doc.data() : {
        heroTitle: 'A sua Beleza, Elevada',
        heroSubtitle: 'Cuidados essenciais para sua pele radiante',
        heroTag: 'Bem-vinda',
        heroBackground: '',
        whatsappName: '',
        whatsappNumber: ''
    };
}

async function updateSiteConfig(data) {
    await db.collection('siteConfig').doc('general').set(data, { merge: true });
}

// ========== FIREBASE STORAGE ==========
async function uploadImage(path, file) {
    const ref = storage.ref().child(path);
    const snap = await ref.put(file);
    return await snap.ref.getDownloadURL();
}

function pickAndUploadImage(storagePath) {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return reject(new Error('Nenhum arquivo selecionado'));
            try {
                const url = await uploadImage(storagePath, file);
                resolve(url);
            } catch (err) { reject(err); }
        };
        input.click();
    });
}

// ========== WAHA (WhatsApp) ==========
const WAHA_PROXY_URL = "/api/waha";
const WAHA_SESSION = "default";

function getWahaUrl() { return WAHA_PROXY_URL; }

function getPhoneVariations(rawPhone) {
    let tel = rawPhone.replace(/\D/g, '');
    if (!tel.startsWith('55')) tel = '55' + tel;
    const variations = [];
    // Always generate BOTH variations: with 9 and without 9
    if (tel.length === 13) {
        // Has 9: 55 + DDD(2) + 9 + number(8) = 13
        variations.push(`${tel}@c.us`);
        const semNove = tel.substring(0, 4) + tel.substring(5);
        variations.push(`${semNove}@c.us`);
    } else if (tel.length === 12) {
        // Without 9: 55 + DDD(2) + number(8) = 12
        variations.push(`${tel}@c.us`);
        const comNove = tel.substring(0, 4) + '9' + tel.substring(4);
        variations.push(`${comNove}@c.us`);
    } else {
        variations.push(`${tel}@c.us`);
    }
    return variations;
}

function removeAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function sendWhatsApp(phone, message) {
    console.group('[WAHA] sendWhatsApp');
    console.log('[WAHA] input phone:', phone);
    console.log('[WAHA] input message:', message);

    const chatIds = getPhoneVariations(phone);
    console.log('[WAHA] phone variations (chatIds):', chatIds);

    const cleanMessage = removeAccents(message);
    console.log('[WAHA] message after removeAccents:', cleanMessage);

    const url = getWahaUrl();
    console.log('[WAHA] proxy url:', url);
    console.log('[WAHA] WAHA_SESSION:', WAHA_SESSION);
    console.log('[WAHA] window.location.protocol:', window.location.protocol);
    console.log('[WAHA] window.location.host:', window.location.host);

    const results = [];
    for (let i = 0; i < chatIds.length; i++) {
        const chatId = chatIds[i];
        const attemptLabel = `[WAHA] attempt ${i + 1}/${chatIds.length} chatId=${chatId}`;
        console.group(attemptLabel);

        const payload = { chatId, text: cleanMessage, session: WAHA_SESSION };
        console.log('payload:', payload);

        const startedAt = Date.now();
        try {
            console.log('fetch ->', url);
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const elapsed = Date.now() - startedAt;
            const text = await res.text();
            let parsed;
            try { parsed = JSON.parse(text); } catch { parsed = text; }

            console.log('response status:', res.status, res.statusText);
            console.log('response ok:', res.ok);
            console.log('response time (ms):', elapsed);
            console.log('response headers:');
            res.headers.forEach((v, k) => console.log('  ', k, '=', v));
            console.log('response body:', parsed);

            results.push({
                chatId,
                ok: res.ok,
                status: res.status,
                statusText: res.statusText,
                elapsedMs: elapsed,
                body: parsed
            });
        } catch (err) {
            const elapsed = Date.now() - startedAt;
            console.error('fetch threw after', elapsed, 'ms:', err);
            console.error('error name:', err.name);
            console.error('error message:', err.message);
            console.error('error stack:', err.stack);
            results.push({
                chatId,
                ok: false,
                error: err.message,
                errorName: err.name,
                elapsedMs: elapsed
            });
        }
        console.groupEnd();
    }

    results.anySuccess = results.some(r => r.ok);
    console.log('[WAHA] anySuccess:', results.anySuccess);
    console.log('[WAHA] all results:', results);
    console.groupEnd();
    return results;
}

// ========== FIRESTORE: STOCK NOTIFICATIONS ==========
// Collection to store "notify me when back in stock" requests
async function addStockNotification(productId, productName, clientName, clientEmail, clientPhone) {
    return await db.collection('stockNotifications').add({
        productId, productName, clientName, clientEmail, clientPhone,
        notified: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function getStockNotifications(productId) {
    const snap = await db.collection('stockNotifications')
        .where('productId', '==', productId)
        .where('notified', '==', false)
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function markStockNotified(notifId) {
    await db.collection('stockNotifications').doc(notifId).update({ notified: true });
}

// ========== FIRESTORE: REAL-TIME LISTENERS ==========
function onBookingsChange(callback) {
    return db.collection('bookings').onSnapshot(snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || '')));
        callback(data);
    }, err => console.error('onBookingsChange error:', err));
}

function onProductOrdersChange(callback) {
    return db.collection('productOrders').onSnapshot(snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        callback(data);
    }, err => console.error('onProductOrdersChange error:', err));
}

function onServicesChange(callback) {
    return db.collection('services').orderBy('name').onSnapshot(snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(data);
    });
}

function onProductsChange(callback) {
    return db.collection('products').orderBy('name').onSnapshot(snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(data);
    });
}

// ========== SEED DEMO DATA ==========
async function seedDemoDataIfEmpty() {
    const svcSnap = await db.collection('services').limit(1).get();
    if (svcSnap.empty) {
        const demoServices = [
            { name: 'Limpeza de Pele', description: 'Limpeza profunda com extração e hidratacao.', price: 120, duration: 60, prepTime: 15, image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=300&fit=crop' },
            { name: 'Massagem Relaxante', description: 'Massagem corporal com oleos essenciais.', price: 150, duration: 50, prepTime: 10, image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop' },
            { name: 'Peeling Facial', description: 'Renovação celular com acidos profissionais.', price: 180, duration: 45, prepTime: 20, image: 'https://images.unsplash.com/photo-1552693673-1bf958298935?w=400&h=300&fit=crop' },
            { name: 'Design de Sobrancelhas', description: 'Modelagem personalizada com henna ou tintura.', price: 60, duration: 30, prepTime: 5, image: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&h=300&fit=crop' },
            { name: 'Drenagem Linfatica', description: 'Tecnica suave para reducao de inchaco e retencao.', price: 140, duration: 60, prepTime: 10, image: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=300&fit=crop' }
        ];
        for (const s of demoServices) {
            await db.collection('services').add({ ...s, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
    }
    const prodSnap = await db.collection('products').limit(1).get();
    if (prodSnap.empty) {
        const demoProducts = [
            { name: 'Protetor Solar FPS50', description: 'Protecao solar de alta performance, toque seco.', price: 89.90, stockType: 'quantidade', stockQuantity: 10, stockAlert: 3, image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=300&fit=crop' },
            { name: 'Serum Vitamina C', description: 'Antioxidante potente para luminosidade.', price: 120, stockType: 'requisicao', deliveryTime: '3 a 5 dias uteis', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&h=300&fit=crop' },
            { name: 'Hidratante Facial', description: 'Hidratação profunda com acido hialuronico.', price: 75, stockType: 'quantidade', stockQuantity: 8, stockAlert: 2, image: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=300&fit=crop' },
            { name: 'Água Micelar', description: 'Limpeza suave e eficaz para todos os tipos de pele.', price: 45, stockType: 'quantidade', stockQuantity: 15, stockAlert: 5, image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=300&fit=crop' }
        ];
        for (const p of demoProducts) {
            await db.collection('products').add({ ...p, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
    }
    // Availability is NOT auto-seeded — admin must configure days/hours manually.
}
