"use strict";

const productCatalog = [
    { id: "signature-loaf", name: "Signature Loaf" },
    { id: "whole-wheat", name: "Whole Wheat Bread" },
    { id: "artisan-loaf", name: "Traditional Artisan Loaf" },
    { id: "croissant", name: "Croissant" },
    { id: "muffin", name: "Muffin" },
    { id: "sweet-roll", name: "Sweet Roll" },
    { id: "handmade-cake", name: "Handmade Cake" }
];

const favoritesKey = "northStarBakery.favorites";
const preOrderKey = "northStarBakery.preOrder";

function findProduct(id) {
    return productCatalog.find(product => product.id === id);
}

function readStored(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch {
        return null;
    }
}

function writeStored(key, value) {
    try {
        if (value === null) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
        return true;
    } catch {
        return false;
    }
}

function restoreFavorites() {
    const saved = readStored(favoritesKey);
    return Array.isArray(saved) ? [...new Set(saved.filter(id => findProduct(id)))] : [];
}

function initializeAssistant(panel) {
    const choice = panel.querySelector("select");
    const toggle = panel.querySelector("button");
    const order = document.getElementById("product-order");
    const list = document.getElementById("favorite-list");
    let favoriteProductIds = restoreFavorites();

    function renderSelection() {
        const saved = favoriteProductIds.includes(choice.value);
        toggle.textContent = saved ? "✓ Favorite" : "☆ Favorite";
        toggle.setAttribute("aria-label", "Favorite: " + findProduct(choice.value).name);
        toggle.setAttribute("aria-pressed", String(saved));
        order.href = "contact.html?product=" + encodeURIComponent(choice.value);
    }

    function renderFavorites() {
        if (favoriteProductIds.length) {
            const items = document.createElement("ul");
            for (const id of favoriteProductIds) {
                const item = document.createElement("li");
                item.textContent = findProduct(id).name;
                items.append(item);
            }
            list.replaceChildren(items);
        } else {
            list.textContent = "No favorites saved yet.";
        }
        renderSelection();
    }

    function toggleFavorite() {
        const id = choice.value;
        if (favoriteProductIds.includes(id)) {
            favoriteProductIds = favoriteProductIds.filter(saved => saved !== id);
        } else {
            favoriteProductIds.push(id);
        }
        const saved = writeStored(favoritesKey, favoriteProductIds);
        document.getElementById("storage-status").textContent = saved ? "" :
            "Browser storage is unavailable. Favorites will last for this visit only.";
        renderFavorites();
    }

    for (const product of productCatalog) {
        choice.add(new Option(product.name, product.id));
    }
    choice.addEventListener("change", renderSelection);
    toggle.addEventListener("click", toggleFavorite);
    order.addEventListener("click", () => writeStored(preOrderKey, choice.value));
    window.addEventListener("storage", event => {
        if (event.key === favoritesKey || event.key === null) {
            favoriteProductIds = restoreFavorites();
            renderFavorites();
        }
    });
    renderFavorites();
    panel.hidden = false;
}

function prefillPreOrder(fields) {
    const url = new URL(location.href);
    const saved = findProduct(readStored(preOrderKey));
    const linked = findProduct(url.searchParams.get("product"));
    const product = linked && linked.id !== saved?.id ? linked : saved;
    if (product && !fields.item_details.value && fields.request_type.value !== "general-question") {
        fields.item_details.value = "I would like to pre-order: " + product.name + ".";
        fields.request_type.value = "pre-order";
    }
    // Consume the selection so clearing the form and refreshing starts a fresh request.
    writeStored(preOrderKey, null);
    if (url.searchParams.has("product")) {
        url.searchParams.delete("product");
        history.replaceState(history.state, "", url);
    }
}

function updatePickupRule(fields) {
    const pickup = fields.pickup_date;
    pickup.required = fields.request_type.value === "pre-order";
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    pickup.min = pickup.required ? today.getFullYear() + "-" + month + "-" + day : "";
}

const requiredMessages = {
    full_name: "Enter your full name.",
    email: "Enter your email address.",
    request_type: "Choose a request type.",
    pickup_date: "Choose a pickup date for your pre-order.",
    item_details: "Describe your items or enter your question."
};

function fieldError(field) {
    if (field.validity.badInput) return "Enter a complete, valid date.";
    if (field.required && !field.value.trim()) return requiredMessages[field.name];
    if (field.validity.typeMismatch) return "Enter an email address such as name@example.com.";
    if (field.validity.rangeUnderflow) return "Choose today or a future pickup date.";
    if (field.name === "item_details" && field.value.trim().length < field.minLength) {
        return "Enter at least 10 characters of item details or a question.";
    }
    return "";
}

function initializeContactForm(form) {
    const fields = form.elements;
    const status = document.getElementById("form-status");
    const validatedFields = Object.keys(requiredMessages).map(name => fields.namedItem(name));
    let attempted = false;
    for (const field of validatedFields) {
        const error = document.createElement("small");
        error.className = "field-error";
        error.id = field.id + "-error";
        field.parentElement.append(error);
        const help = field.getAttribute("aria-describedby") || "";
        field.setAttribute("aria-describedby", (help + " " + error.id).trim());
    }

    function validateContactForm() {
        updatePickupRule(fields);
        return validatedFields.filter(field => {
            const message = fieldError(field);
            document.getElementById(field.id + "-error").textContent = message;
            field.setAttribute("aria-invalid", String(Boolean(message)));
            return Boolean(message);
        });
    }

    prefillPreOrder(fields);
    updatePickupRule(fields);
    form.noValidate = true;
    form.querySelector('[type="submit"]').disabled = false;
    form.addEventListener("submit", event => {
        event.preventDefault();
        attempted = true;
        const invalid = validateContactForm();
        if (invalid.length) {
            status.textContent = "Please correct the marked fields.";
            invalid[0].focus();
        } else {
            status.textContent = "Demo check complete. Your details are valid. No request was sent.";
        }
    });
    form.addEventListener("input", () => {
        status.textContent = "";
        if (attempted) validateContactForm();
        else updatePickupRule(fields);
    });
    form.addEventListener("reset", () => {
        attempted = false;
        status.textContent = "";
        for (const field of validatedFields) {
            field.removeAttribute("aria-invalid");
            document.getElementById(field.id + "-error").textContent = "";
        }
        queueMicrotask(() => updatePickupRule(fields));
    });
}

const assistant = document.getElementById("bakery-assistant");
if (assistant) initializeAssistant(assistant);
const contactForm = document.querySelector(".contact-layout form");
if (contactForm) initializeContactForm(contactForm);
