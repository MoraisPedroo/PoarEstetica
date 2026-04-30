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
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return cred.user;
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
        heroBackground: ''
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
const WAHA_DIRECT_URL = "http://136.115.81.162:3000/api/sendText";
const WAHA_PROXY_URL = "/api/waha"; // Vercel serverless proxy (HTTPS safe)
const WAHA_API_KEY = "segredo123";
const WAHA_SESSION = "default";

// Use proxy on HTTPS (Vercel deploy), direct on HTTP (localhost)
function getWahaUrl() {
    return window.location.protocol === 'https:' ? WAHA_PROXY_URL : WAHA_DIRECT_URL;
}

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

/**
 * Send WhatsApp message via WAHA.
 * ALWAYS sends to BOTH phone variations (with and without 9).
 * Uses Vercel proxy when on HTTPS to avoid Mixed Content error.
 */
async function sendWhatsApp(phone, message) {
    const chatIds = getPhoneVariations(phone);
    const cleanMessage = removeAccents(message);
    const url = getWahaUrl();
    const isProxy = url === WAHA_PROXY_URL;
    const results = [];
    // Send to ALL variations — do NOT break on first success
    for (const chatId of chatIds) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (!isProxy) headers['X-Api-Key'] = WAHA_API_KEY;
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    chatId,
                    text: cleanMessage,
                    session: WAHA_SESSION
                })
            });
            results.push({ chatId, ok: res.ok, status: res.status });
        } catch (err) {
            results.push({ chatId, ok: false, error: err.message });
        }
    }
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
            { name: 'Limpeza de Pele', description: 'Limpeza profunda com extracao e hidratacao.', price: 120, duration: 60, prepTime: 15, image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=300&fit=crop' },
            { name: 'Massagem Relaxante', description: 'Massagem corporal com oleos essenciais.', price: 150, duration: 50, prepTime: 10, image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop' },
            { name: 'Peeling Facial', description: 'Renovacao celular com acidos profissionais.', price: 180, duration: 45, prepTime: 20, image: 'https://images.unsplash.com/photo-1552693673-1bf958298935?w=400&h=300&fit=crop' },
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
            { name: 'Hidratante Facial', description: 'Hidratacao profunda com acido hialuronico.', price: 75, stockType: 'quantidade', stockQuantity: 8, stockAlert: 2, image: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=300&fit=crop' },
            { name: 'Agua Micelar', description: 'Limpeza suave e eficaz para todos os tipos de pele.', price: 45, stockType: 'quantidade', stockQuantity: 15, stockAlert: 5, image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=300&fit=crop' }
        ];
        for (const p of demoProducts) {
            await db.collection('products').add({ ...p, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
    }
    // Availability is NOT auto-seeded — admin must configure days/hours manually.
}
