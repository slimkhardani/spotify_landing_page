"use strict";

/* ========== UTILITAIRES ========== */
const $  = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

// Respect de prefers-reduced-motion
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const prefersReducedMotion = () => reduceMotionQuery.matches;

// localStorage "sécurisé" : ne plante jamais si le stockage est bloqué
const store = {
    get(key) {
        try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
        try { localStorage.setItem(key, value); } catch { /* stockage indisponible */ }
    }
};


/* ========== 1. THÈME CLAIR / SOMBRE ========== */
function initTheme() {
    const root = document.documentElement;
    const button = $("#themeToggle");
    if (!button) return;

    const icon = $(".theme-icon", button);
    const metaTheme = $('meta[name="theme-color"]');
    const systemQuery = window.matchMedia("(prefers-color-scheme: light)");

    function applyTheme(theme) {
        const isLight = theme === "light";
        root.setAttribute("data-theme", theme);
        button.setAttribute("aria-label",
            isLight ? "Passer en mode sombre" : "Passer en mode clair");
        icon.textContent = isLight ? "☾" : "☀";
        if (metaTheme) metaTheme.setAttribute("content", isLight ? "#ffffff" : "#121212");
    }

    // Le thème initial a déjà été posé par le script du <head>
    applyTheme(root.getAttribute("data-theme") || (systemQuery.matches ? "light" : "dark"));

    button.addEventListener("click", () => {
        const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
        applyTheme(next);
        store.set("theme", next);          // choix mémorisé
    });

    // Si le visiteur n'a jamais choisi, on suit le système en direct
    systemQuery.addEventListener("change", (event) => {
        if (!store.get("theme")) applyTheme(event.matches ? "light" : "dark");
    });
}


/* ========== 2. CARROUSEL DE CAPTURES ========== */
function initCarousel() {
    const root = $("#carousel");
    if (!root) return;

    const viewport = $(".carousel-viewport", root);
    const track = $(".carousel-track", root);
    const slides = $$(".slide", root);
    const dotsBox = $(".carousel-dots", root);
    const prevBtn = $("[data-carousel-prev]", root);
    const nextBtn = $("[data-carousel-next]", root);
    let index = 0;

    // Création des points (indicateurs)
    const dots = slides.map((_, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "carousel-dot";
        dot.setAttribute("aria-label", `Aller à la capture ${i + 1} sur ${slides.length}`);
        dot.addEventListener("click", () => goTo(i));
        dotsBox.appendChild(dot);
        return dot;
    });

    // Aller à une capture (navigation circulaire)
    function goTo(i) {
        index = (i + slides.length) % slides.length;
        track.style.transform = `translateX(-${index * 100}%)`;

        slides.forEach((slide, k) =>
            slide.setAttribute("aria-hidden", String(k !== index)));

        dots.forEach((dot, k) => {
            dot.classList.toggle("is-active", k === index);
            if (k === index) dot.setAttribute("aria-current", "true");
            else dot.removeAttribute("aria-current");
        });
    }

    prevBtn.addEventListener("click", () => goTo(index - 1));
    nextBtn.addEventListener("click", () => goTo(index + 1));

    // Flèches du clavier ← →
    // Actives quand le carrousel est visible à l'écran ou qu'il a le focus
    let carouselVisible = true;
    if ("IntersectionObserver" in window) {
        new IntersectionObserver(([entry]) => {
            carouselVisible = entry.isIntersecting;
        }, { threshold: 0.3 }).observe(root);
    }

    document.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.target.closest("input, textarea, select")) return;   // ne pas gêner la saisie
        if (!carouselVisible && !root.contains(event.target)) return;

        event.preventDefault();
        goTo(index + (event.key === "ArrowRight" ? 1 : -1));
    });

    // Swipe tactile / souris
    let startX = null;
    viewport.addEventListener("pointerdown", (e) => { startX = e.clientX; });
    viewport.addEventListener("pointerup", (e) => {
        if (startX === null) return;
        const deltaX = e.clientX - startX;
        startX = null;
        if (Math.abs(deltaX) > 40) goTo(index + (deltaX < 0 ? 1 : -1));
    });
    viewport.addEventListener("pointercancel", () => { startX = null; });

    goTo(0);
}


/* ========== 3. ANIMATIONS AU SCROLL ========== */
const REVEAL_SELECTOR =
    ".section-heading, .genre-card, .feature-card, .stat, .sponsor-card, " +
    ".premium-text, .premium-art, .launch-box, .cta-box";

function initReveal() {
    // prefers-reduced-motion : on ne cache rien, le contenu est visible directement
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) return;

    const items = $$(REVEAL_SELECTOR);

    items.forEach((el) => {
        // Décalage en cascade selon la position parmi les frères (max 4)
        const position = [...el.parentElement.children].indexOf(el);
        el.style.setProperty("--i", Math.min(position, 4));
        el.classList.add("reveal");
    });

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                obs.unobserve(entry.target);     // une seule fois
            }
        });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    items.forEach((el) => observer.observe(el));
}


/* ========== 4. BOUTON RETOUR EN HAUT ========== */
function initBackToTop() {
    const button = $("#backToTop");
    if (!button) return;

    const SHOW_AFTER = 600;        // px de défilement avant l'apparition
    let ticking = false;

    function update() {
        button.classList.toggle("is-shown", window.scrollY > SHOW_AFTER);
        ticking = false;
    }

    // requestAnimationFrame : évite d'exécuter le code à chaque pixel de scroll
    window.addEventListener("scroll", () => {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    }, { passive: true });

    button.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: prefersReducedMotion() ? "auto" : "smooth"
        });
        // Rend le focus à un élément du haut de page (utile au clavier)
        $(".logo")?.focus({ preventScroll: true });
    });

    update();
}


/* ========== 5. FORMULAIRE AVEC VALIDATION ========== */
function initForm() {
    const form = $("#launchForm");
    if (!form) return;

    const status = $("#formStatus");

    // Règles : renvoient un message d'erreur, ou "" si le champ est valide
    const rules = {
        nom(value) {
            if (!value) return "Merci d’indiquer ton nom.";
            if (value.length < 2) return "Ton nom doit contenir au moins 2 caractères.";
            if (!/^[\p{L}][\p{L}\s'’.-]*$/u.test(value))
                return "Ton nom ne doit contenir que des lettres, espaces, apostrophes ou tirets.";
            return "";
        },
        email(value) {
            if (!value) return "Merci d’indiquer ton adresse e-mail.";
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value))
                return "Le format de l’e-mail est invalide (exemple : nom@exemple.com).";
            return "";
        }
    };

    const fields = Object.keys(rules).map((name) => ({
        name,
        input: $("#" + name),
        error: $("#" + name + "-error")
    }));

    // Valide un champ, affiche/efface son message, renvoie true si valide
    function validate(field) {
        const message = rules[field.name](field.input.value.trim());
        field.error.textContent = message;
        field.input.setAttribute("aria-invalid", String(message !== ""));
        return message === "";
    }

    fields.forEach((field) => {
        // Vérification quand on quitte le champ
        field.input.addEventListener("blur", () => validate(field));
        // Si le champ était en erreur, on re-vérifie pendant la frappe
        field.input.addEventListener("input", () => {
            if (field.input.getAttribute("aria-invalid") === "true") validate(field);
        });
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();                 // pas de rechargement de la page
        status.textContent = "";
        status.classList.remove("is-success");

        const results = fields.map(validate);   // on valide TOUS les champs
        const firstInvalid = fields.find((_, i) => !results[i]);

        if (firstInvalid) {
            firstInvalid.input.focus();         // le focus va sur le 1er champ en erreur
            return;
        }

        const name = form.elements.nom.value.trim();
        const email = form.elements.email.value.trim();

        // Enregistre l'inscription (simulation) : visible dans F12 → Application → Local Storage
        let signups = [];
        try { signups = JSON.parse(store.get("signups")) || []; } catch { signups = []; }
        signups.push({ name, email, date: new Date().toLocaleString("fr-FR") });
        store.set("signups", JSON.stringify(signups));

        // textContent (et non innerHTML) : protège contre l'injection de code
        status.textContent =
            `Merci ${name} ! Tu seras prévenu(e) du lancement à l’adresse ${email}.`;
        status.classList.add("is-success");

        form.reset();
        fields.forEach((f) => {
            f.error.textContent = "";
            f.input.removeAttribute("aria-invalid");
        });
    });
}


/* ========== 6. COMPTEURS ANIMÉS (BONUS) ========== */
function formatCounter(el, value) {
    const decimals = Number(el.dataset.decimals) || 0;
    const number = value.toLocaleString("fr-FR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
    return number + (el.dataset.suffix || "");
}

function runCounter(el) {
    const target = Number(el.dataset.target);
    const duration = 2000;
    const start = performance.now();

    function frame(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);        // ralentit vers la fin
        el.textContent = formatCounter(el, target * eased);
        if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function initCounters() {
    const counters = $$(".counter");
    if (!counters.length) return;

    // Pas d'animation : on affiche directement la valeur finale
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
        counters.forEach((el) => {
            el.textContent = formatCounter(el, Number(el.dataset.target));
        });
        return;
    }

    counters.forEach((el) => { el.textContent = formatCounter(el, 0); });   // départ à 0

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                runCounter(entry.target);        // démarre quand la section devient visible
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach((el) => observer.observe(el));
}


/* ========== 7. CHOIX DE PLATEFORME (BONUS) ========== */
const STORES = {
    ios: {
        url: "https://apps.apple.com/app/spotify-music-and-podcasts/id324684580",
        full: "Télécharger sur l’App Store",
        short: "Télécharger iOS"
    },
    android: {
        url: "https://play.google.com/store/apps/details?id=com.spotify.music",
        full: "Télécharger sur Google Play",
        short: "Télécharger Android"
    }
};

function initPlatform() {
    const buttons = $$(".platform-btn");
    const downloads = $$("[data-download]");
    if (!buttons.length) return;

    // Détection automatique si le visiteur n'a encore rien choisi
    function detectPlatform() {
        return /android/i.test(navigator.userAgent) ? "android" : "ios";
    }

    function applyPlatform(platform) {
        const info = STORES[platform];

        buttons.forEach((btn) =>
            btn.setAttribute("aria-pressed", String(btn.dataset.platform === platform)));

        downloads.forEach((link) => {
            link.href = info.url;
            $(".dl-label", link).textContent =
                link.dataset.download === "short" ? info.short : info.full;
        });
    }

    const saved = store.get("platform");
    applyPlatform(STORES[saved] ? saved : detectPlatform());

    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
            applyPlatform(btn.dataset.platform);
            store.set("platform", btn.dataset.platform);   // mémorisé même après rechargement
        });
    });
}


/* ========== 0. ÉCRAN DE CHARGEMENT ========== */
function initPreloader() {
    const preloader = $("#preloader");
    if (!preloader) return;

    // Durée minimale d'affichage : évite un clignotement si la page se charge très vite
    // Performance : 400 ms au lieu de 900 ms, et on n'attend plus l'événement
    // "load" (images, polices) : le script est en "defer", donc le DOM est déjà prêt.
    const MIN_TIME = prefersReducedMotion() ? 0 : 400;
    const startTime = performance.now();

    function hide() {
        const wait = Math.max(0, MIN_TIME - (performance.now() - startTime));
        setTimeout(() => {
            preloader.classList.add("is-hidden");
            setTimeout(() => preloader.remove(), 600);   // retire l'élément du DOM
        }, wait);
    }

    hide();
}


/* ========== INITIALISATION ========== */
initPreloader();
initTheme();
initPlatform();
initCarousel();
initReveal();
initCounters();
initBackToTop();
initForm();