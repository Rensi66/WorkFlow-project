const newPassInput = document.getElementById('new-password');
const segments = document.querySelectorAll('.strength-segment');
const strengthText = document.querySelector('.strength-text span');

newPassInput.addEventListener('input', () => {
    const password = newPassInput.value;
    let score = 0;

    if (password.length > 0) {
        // 1. Любые символы (даже кириллица) — это минимум 1 балл
        score = 1; 

        // Проверки на наличие разных типов данных
        const hasLetters = /[a-zA-Zа-яА-ЯёЁ]/.test(password); // Латиница ИЛИ Кириллица
        const hasDigits = /\d/.test(password);
        const hasSpecial = /[^a-zA-Zа-яА-ЯёЁ0-9]/.test(password);

        // 2. Есть и буквы, и цифры
        if ((hasLetters && hasDigits) | (hasSpecial && hasDigits )| (hasLetters && hasSpecial)) {
            score = 2;
        }

        // 3. Буквы + цифры + спецсимволы
        if (hasLetters && hasDigits && hasSpecial) {
            score = 3;
        }

        // 4. Крепкий: всё выше + длина + регистр
        const isLongEnough = password.length >= 10;
        // Проверка регистра (работает и для латиницы, и для кириллицы)
        const hasMixedCase = password !== password.toLowerCase() && password !== password.toUpperCase();
        
        if (score === 3 && isLongEnough && hasMixedCase) {
            score = 4;
        }
    } else {
        score = 0;
    }

    updateStrengthUI(score);
});

function updateStrengthUI(score) {
    // Сбрасываем все сегменты
    segments.forEach(s => {
        s.className = 'strength-segment'; 
        s.style.background = '#262626';
    });

    const labels = ['Пусто', 'Слабый', 'Легко взломать', 'Средний', 'Крепкий'];
    const colors = ['#888', '#ef4444', '#f59e0b', '#eab308', '#10b981'];
    const classes = ['', 'segment-red', 'segment-orange', 'segment-yellow', 'segment-green'];

    strengthText.textContent = labels[score];
    strengthText.style.color = colors[score];

    // Закрашиваем нужное количество сегментов
    for (let i = 0; i < score; i++) {
        segments[i].classList.add(classes[score]);
    }
}


async function changePassword() {
    const btn = document.querySelector('.btn-submit-green');
    const oldPass = document.getElementById('old-password').value;
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-password').value;

    // 1. Базовая валидация на фронте
    if (!oldPass || !newPass || !confirmPass) {
        alert('Пожалуйста, заполните все поля');
        return;
    }

    if (newPass !== confirmPass) {
        alert('Новые пароли не совпадают');
        return;
    }

    if (newPass.length < 8) {
        alert('Новый пароль слишком короткий (минимум 8 символов)');
        return;
    }

    // 2. Визуальное состояние загрузки
    const originalText = btn.textContent;
    btn.textContent = 'Обновление...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    try {
        const response = await fetch('/api/change_password', {
            method: 'PATCH', // Или 'PATCH', зависит от твоего API
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                old_password: oldPass,
                new_password: newPass
            })
        });

        const result = await response.json();

        if (response.ok) {
            // Очищаем форму
            document.querySelector('.password-form').reset();
            // Сбрасываем индикатор сложности (если есть функция сброса)
            resetStrengthMeter(); 

            await updateSecurityLevel();
        } else {
            // Выводим ошибку от сервера (например, "Неверный текущий пароль")
            alert(result.detail || 'Ошибка при смене пароля');
        }

    } catch (error) {
        console.error('Ошибка запроса:', error);
        alert('Ошибка соединения с сервером');
    } finally {
        // 3. Возвращаем кнопку в исходное состояние
        btn.textContent = originalText;
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

// Привязываем функцию к кнопке
document.querySelector('.btn-submit-green').addEventListener('click', (e) => {
    e.preventDefault();
    changePassword();
});


function resetStrengthMeter() {
    updateStrengthUI(0);
}


/* ИСПРАВЛЕННЫЙ СКРИПТ ГЛАЗА */
document.querySelectorAll('.js-toggle-visibility').forEach(button => {
    button.addEventListener('click', function(e) {
        e.preventDefault(); // На всякий случай
        
        // Ищем инпут строго внутри ближайшей обертки .password-field-wrapper
        const wrapper = this.closest('.password-field-wrapper');
        if (!wrapper) return; // Если мы не в обертке (например, в блоке защиты), ничего не делаем
        
        const input = wrapper.querySelector('input');
        if (!input) return;

        if (input.type === 'password') {
            input.type = 'text';
            this.style.color = '#10b981';
            this.style.opacity = '1';
        } else {
            input.type = 'password';
            this.style.color = 'currentColor';
            this.style.opacity = '0.5';
        }
    });
});

// Выносим переменную наружу, чтобы помнить предыдущее состояние
let lastPercent = 0; 

async function updateSecurityLevel() {
    try {
        const response = await fetch('/api/security_level');
        const data = await response.json();

        // --- УСТАНОВКА СОСТОЯНИЯ ТУМБЛЕРА ПРИ ЗАГРУЗКЕ ---
        if (tfaToggle && tfaStatusLabel) {
            tfaToggle.checked = data.tfa_enabled;
            if (data.tfa_enabled) {
                tfaStatusLabel.textContent = 'Включено';
                tfaStatusLabel.classList.add('active');
            } else {
                tfaStatusLabel.textContent = 'Выключено';
                tfaStatusLabel.classList.remove('active');
            }
        }
        // ------------------------------------------------

        let totalPercent = 0;
        const checklist = document.querySelector('.protection-checklist');
        checklist.innerHTML = ''; 

        // ... далее твой код с addItem, кругом и анимацией ...
        const addItem = (text, isDone, value) => {
            if (isDone) totalPercent += value;
            const li = document.createElement('li');
            li.className = `check-item ${isDone ? 'done' : 'todo'}`;
            li.textContent = text;
            checklist.appendChild(li);
        };

        addItem('Email подтверждён', data.email_confirmed, 20);
        addItem('2FA включена', data.tfa_enabled, 35);
        addItem('Надежный пароль', data.password_strong, 45);

        const circle = document.querySelector('.progress-circle');
        const valueDisplay = document.querySelector('.progress-value');
        
        circle.style.setProperty('--progress', totalPercent);
        animateValue(valueDisplay, lastPercent, totalPercent, 1000);
        lastPercent = totalPercent;

    } catch (error) {
        console.error('Ошибка загрузки уровня безопасности:', error);
    }
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Вычисляем значение (оно будет уменьшаться, если end < start)
        const currentCount = Math.floor(progress * (end - start) + start);
        obj.innerHTML = currentCount + "%";
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Вызываем при загрузке
document.addEventListener('DOMContentLoaded', updateSecurityLevel);

// Функция для выхода из системы
async function handleLogout() {
    try {
        // Отправляем запрос на логаут
        const response = await fetch('/api/exit', {
            method: 'POST', // Обычно выход делается через POST для безопасности
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            // Если сервер ответил успешно, перенаправляем на страницу входа
            window.location.href = '/workflow/login';
        } else {
            console.error('Ошибка при выходе: сервер вернул статус', response.status);
            // Даже если сервер ответил ошибкой, иногда лучше все равно редиректнуть
            window.location.href = '/workflow/login';
        }
    } catch (error) {
        console.error('Сетевая ошибка при попытке выхода:', error);
    }
}

// Назначаем обработчик на все кнопки с классом logout-btn
document.addEventListener('DOMContentLoaded', () => {
    const logoutButtons = document.querySelectorAll('.logout-btn');
    
    logoutButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault(); // Предотвращаем дефолтное поведение
            handleLogout();
        });
    });
});


const tfaToggle = document.getElementById('tfa-toggle');
const tfaStatusLabel = document.getElementById('tfa-status-label');

tfaToggle.addEventListener('change', async function(event) {
    // Сохраняем текущее состояние на случай ошибки
    const isChecked = this.checked;
    
    try {
        // Отправляем запрос на бэкенд
        // Передаем статус (true/false) в зависимости от положения переключателя
        const response = await fetch('/api/change_user_tfa_enabled', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const result = await response.json();

        if (result.status === true) {
            // Если всё ок — обновляем текст и стили
            if (isChecked) {
                tfaStatusLabel.textContent = 'Включено';
                tfaStatusLabel.classList.add('active');
            } else {
                tfaStatusLabel.textContent = 'Выключено';
                tfaStatusLabel.classList.remove('active');
            }

            await updateSecurityLevel();
        } else {
            // Если сервер вернул False — отменяем визуальное переключение
            this.checked = !isChecked;
            console.error("Ошибка: сервер не подтвердил изменения");
        }
    } catch (error) {
        // Если произошла сетевая ошибка — тоже возвращаем назад
        this.checked = !isChecked;
        console.error("Ошибка при запросе к API:", error);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
            overlay.classList.add('show');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('show');
        });
    }
});