let CurrentVersion;

const API_BASE = 'http://localhost:3000';

function applySystemTheme() {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
}

function setTheme(theme) {
    if (theme === "system") {
        applySystemTheme();
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySystemTheme);
    } else {
        document.documentElement.setAttribute("data-theme", theme);
    }
    localStorage.setItem("mm:theme", theme);
}

function getTheme() {
    const theme = localStorage.getItem("mm:theme") || "light";
    setTheme(theme);
}

getTheme();

async function getAppVersion() {
  const cachedVersion = sessionStorage.getItem('mm:CurrentVersion');
  if (cachedVersion) {
    return cachedVersion;
  }
  const res = await fetch(`${API_BASE}/get-app-version/`);
  if (!res.ok) throw new Error('failed get version');
  const data = await res.json();
  sessionStorage.setItem('mm:CurrentVersion', data.version);
  return data.version;
}

const showMessage = (message, opts = {}) => {
  const {
    type = "success", // success | error | warning | info
    duration = 3000,
    persistent = false,
    onClose = null,
  } = opts;

  let wrapper = document.getElementById("mm-global-toast-wrapper");
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.id = "mm-global-toast-wrapper";
    document.body.appendChild(wrapper);
  }

  if (wrapper.children.length > 0) {
    const firstToast = wrapper.children[0];
    firstToast?.close?.();
  }

  const icons = {
    success: "bi bi-check-circle-fill text-success",
    error: "bi bi-x-circle-fill text-danger",
    warning: "bi bi-exclamation-triangle-fill text-warning",
    info: "bi bi-info-circle-fill text-info",
  };

  const toast = document.createElement("div");
  toast.className = "mm-glass-toast showing";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  const icon = document.createElement("i");
  icon.className = `${icons[type] || icons.success} mm-toast-icon`;

  const content = document.createElement("div");
  content.className = "mm-toast-content";
  if (message instanceof HTMLElement) content.appendChild(message);
  else content.innerHTML = message;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "mm-toast-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.title = "Закрити";

  toast.append(icon, content, closeBtn);
  wrapper.appendChild(toast);

  let removed = false;
  function closeToast() {
    if (removed) return;
    removed = true;
    toast.classList.remove("showing");
    toast.classList.add("hiding");
    toast.addEventListener(
      "animationend",
      () => {
        toast.remove();
        if (!wrapper.children.length) wrapper.remove();
        if (typeof onClose === "function") onClose();
      },
      { once: true }
    );
  }

  closeBtn.addEventListener("click", closeToast);

  if (duration > 0 && !persistent) setTimeout(closeToast, duration);

  toast.close = closeToast;

  return { close: closeToast, element: toast };
};

function showUpdateToast(latestVersion) {
  const container = document.createElement("div");
  container.innerHTML = `
    <div class="d-flex flex-column">
      <div class="text-muted">
        Доступна новая версия: <strong>${latestVersion}</strong>
      </div>
      <div class="mt-1 d-flex justify-content-evenly">
        <button class="update-download btn-xs btn-glass">Завантажити</button>
        <button class="update-later btn-xs btn-glass">Пізніше</button>
      </div>
    </div>
  `;


  const toastObj = showMessage(container, { type: "warning", persistent: true });

  container.querySelector(".update-download").addEventListener("click", async () => {
    toastObj.close(); 
    try {
      const res = await fetch(`${API_BASE}/download-update/`);
      if (!res.ok) {
        showMessage("Помилка завантаження оновлення", { type: 'error' });
        return;
      }
      const data = await res.json();
      if (data.error) {
        showMessage(`Помилка: ${data.error}`, { type: 'error' });
        return;
      }

      showMessage("Завантаження оновлення розпочато!");
    } catch (err) {
      console.error(err);
      showMessage("Помилка при підключенні до сервера", { type: 'error' });
    }
  });

  container.querySelector(".update-later").addEventListener("click", () => {
    toastObj.close(); 
  });
}

async function checkForUpdates(showSuccessMes = false) {
  try {
    const cachedVersion = sessionStorage.getItem('mm:CheckUpdates');
    if (cachedVersion) {
      if (cachedVersion !== CurrentVersion && cachedVersion !== 'У вас встановлена остання версія') {
        showUpdateToast(cachedVersion);
      } else if (showSuccessMes) {
        showMessage(cachedVersion);
      }
      return cachedVersion;
    }

    const res = await fetch(`${API_BASE}/get-latest-version/`);
    if (!res.ok) return;

    const data = await res.json();
    const latestVersion = data.latestVersion;

    if (latestVersion && latestVersion !== CurrentVersion) {
      sessionStorage.setItem('mm:CheckUpdates', latestVersion);
      showUpdateToast(latestVersion);
    } else {
      sessionStorage.setItem('mm:CheckUpdates', 'У вас встановлена остання версія');
      if (showSuccessMes) showMessage(message);
    }
  } catch (err) {
    console.error('[checkForUpdates] error', err);
  }
}

document.addEventListener("DOMContentLoaded", async () => { 
  CurrentVersion = await getAppVersion();
  await checkUpdatesOnLoad();

  initAIOnLoad();
});

async function initAIOnLoad() {
  try {
    const isAiInited = sessionStorage.getItem('mm:AI_inited') === 'true'; 
    if (!isAiInited) { 
      const res = await fetch(`${API_BASE}/init-ai-using/`);
      if (!res.ok) {
        showMessage("Помилка ініціалізаціі AI скрипту", { type: 'error' });
      } else {
        sessionStorage.setItem('mm:AI_inited', 'true');
      }
    }
  } catch (error) {
    console.error('Network error during AI init:', error);
    showMessage("Помилка мережі при ініціалізаціі AI", { type: 'error' });
  }
}

async function checkUpdatesOnLoad() {
  if (!sessionStorage.getItem('mm:CheckUpdates')) {
    await checkForUpdates();
  }
}