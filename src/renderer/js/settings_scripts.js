document.addEventListener("DOMContentLoaded", async () => { 
    document.getElementById("check-update").addEventListener("click", () => checkForUpdates(true));
    const appVersion = document.getElementById('appVersion');

    appVersion.innerText = CurrentVersion;

    document.querySelectorAll('#settingsNav button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#settingsNav button').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.dataset.bsTarget || btn.getAttribute('data-bs-target');
            document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('show','active'));
            const pane = document.querySelector(target);
            pane.classList.add('show','active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    const formFields = ['userName','userEmail','userLang','emailPromos','pushNotify','notifFreq','hideProfile','adsAudience','fontSize','webhookUrl', 'aiFeatures'];

    function saveSettings(){
        formFields.forEach(id=>{
            const el = document.getElementById(id);
            if(!el) return;
            let val = null;
            if(el.type === 'checkbox') val = el.checked;
            else val = el.value;
            localStorage.setItem('mm:'+id, JSON.stringify(val));
        });

        const theme = document.querySelector('input[name="theme"]:checked').id.replace("theme","");
        localStorage.setItem('mm:theme', theme.toLowerCase());
        setTheme(theme.toLowerCase());

        localStorage.setItem('mm:lastSaved', new Date().toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }));
        document.getElementById('lastSaved').textContent = localStorage.getItem('mm:lastSaved');
        showMessage('Налаштування збережені');
    }

    function loadSettings(){
        formFields.forEach(id=>{
            const el = document.getElementById(id);
            if(!el) return;
            const raw = localStorage.getItem('mm:'+id)  ?? 'false';
            if(raw === null) return;
            const val = JSON.parse(raw);
            if(el.type === 'checkbox') el.checked = val;
            else el.value = val;
        });

        const theme = localStorage.getItem('mm:theme') || "system";
        document.getElementById("theme"+theme.charAt(0).toUpperCase()+theme.slice(1)).checked = true;
        setTheme(theme);

        const last = localStorage.getItem('mm:lastSaved');
        if(last) document.getElementById('lastSaved').textContent = last;
    }

    document.getElementById('saveBtn').addEventListener('click', saveSettings);
    document.getElementById('saveTop').addEventListener('click', saveSettings);
    document.getElementById('resetBtn').addEventListener('click', ()=>{
        if(confirm('Скинути всі налаштування до значень за замовчуванням?')){
            localStorage.clear();
            loadSettings();
            showMessage('Налаштування скинуто');
        }
    });

    loadSettings();
});
