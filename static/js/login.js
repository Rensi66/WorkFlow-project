const loginForm = document.querySelector('.login-form');
const modalOverlay = document.getElementById('modalOverlay');
const closeModal = document.getElementById('closeModal');
const confirmForm = document.getElementById('confirmForm');

// 1. Обработка Входа
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            // ПРОВЕРКА: Если сервер просит подтверждение почты
            if (result.long_check === true) {
                modalOverlay.classList.add('active');
            } else {
                window.location.href = '/workflow';
            }
        } else {
            alert(result.detail || 'Ошибка авторизации');
        }
    } catch (error) {
        alert('Ошибка связи с сервером');
    }
});

// 2. Обработка Подтверждения Кода
confirmForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const codeValue = document.getElementById('emailCode').value;

    try {
        const response = await fetch('/api/confirm_email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Твоя Pydantic схема ждет { "code": int }
            body: JSON.stringify({ code: parseInt(codeValue) })
        });

        const result = await response.json();

        if (response.ok && result.status) {;
            modalOverlay.classList.remove('active');
            // Очищаем пароль для безопасности и просим войти заново 
            // или редиректим, если бэкенд сразу ставит куку
            window.location.href ='/workflow'; 
        } else {
            console.log(response.ok)
            console.log(result.status)
            alert(result.detail || 'Неверный код подтверждения');
        }
    } catch (error) {
        alert('Ошибка при подтверждении');
    }
});

// Закрытие модалки
closeModal.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
});