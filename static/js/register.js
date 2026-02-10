const registrationForm = document.querySelector('.login-form');
const confirmForm = document.getElementById('confirmForm');
const modalOverlay = document.getElementById('modalOverlay');
const closeModal = document.getElementById('closeModal');

let registrationData = {}; // Временное хранилище данных формы

// 1. Отправка данных и вызов модалки
registrationForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(registrationForm);
    registrationData = Object.fromEntries(formData.entries());

    if (registrationData.user_password !== registrationData.second_user_password) {
        alert("Пароли не совпадают!");
        return;
    }

    try {
        // Вызываем эндпоинт регистрации (который создает юзера и шлет код)
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registrationData)
        });

        const result = await response.json();

        if (response.ok) {
            // Показываем окно ввода кода
            modalOverlay.classList.add('active');
        } else {
            alert(`Ошибка: ${result.detail || 'Не удалось отправить код'}`);
        }
    } catch (error) {
        alert('Ошибка сети при регистрации');
    }
});

// 2. Подтверждение кода
confirmForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('emailCode').value;

    try {
        const response = await fetch('/api/confirm_email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: registrationData.user_email, 
                code: code 
            })
        });

        const result = await response.json();

        if (response.ok) {;
            window.location.href = '/workflow';
        } else {
            alert(`Ошибка кода: ${result.detail || 'Неверный код'}`);
        }
    } catch (error) {
        alert('Ошибка сети при проверке кода');
    }
});

// Закрытие модалки
closeModal.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
});