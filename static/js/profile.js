let currentUserData = null;

/**
 * Функция для выхода из системы
 */
async function handleLogout() {
    try {
        const response = await fetch('/api/exit', {
            method: 'POST', // В FastAPI у тебя прописан @app.get
        });

        if (response.ok) {
            // Если кука удалена успешно, редиректим
            window.location.href = '/workflow/login';
        } else {
            console.error('Ошибка при выходе');
            // Принудительный редирект, если что-то пошло не так
            window.location.href = '/workflow/login';
        }
    } catch (error) {
        console.error('Сетевая ошибка при выходе:', error);
    }
}

/**
 * Загрузка данных пользователя и статистики
 */
async function loadUserData() {
    try {
        const userResponse = await fetch('/api/get_user');

        if (userResponse.status === 401) {
            window.location.href = '/workflow/login';
            return;
        }

        if (!userResponse.ok) throw new Error('Ошибка при получении данных профиля');

        currentUserData = await userResponse.json();

        const nameInput = document.getElementById('user-name');
        if (nameInput) nameInput.value = currentUserData.user_name || '';

        const emailInput = document.getElementById('user-email');
        if (emailInput) emailInput.value = currentUserData.user_email || '';

        const idInput = document.getElementById('user-id');
        if (idInput) idInput.value = currentUserData.user_id || '';

        const streakResponse = await fetch('/api/streak');
        const totalResponse = await fetch('/api/total');

        if (streakResponse.ok && totalResponse.ok) {
            const stats = await streakResponse.json();
            const total = await totalResponse.json();
            
            const totalTasksEl = document.getElementById('total_info');
            const streakEl = document.getElementById('streak_info');

            if (totalTasksEl && total !== undefined) {
                totalTasksEl.textContent = total.total;
            }
            if (streakEl && stats !== undefined) {
                streakEl.textContent = stats;
            }
        }

    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

/**
 * Сохранение изменений
 */
async function saveChanges() {
    if (!currentUserData) return;

    const nameInput = document.getElementById('user-name');
    const emailInput = document.getElementById('user-email');

    const newName = nameInput.value.trim();
    const newEmail = emailInput.value.trim();

    if (!newName || !newEmail) {
        alert("Имя и почта не могут быть пустыми");
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        alert("Пожалуйста, введите корректный адрес электронной почты");
        emailInput.style.borderColor = '#ef4444';
        return;
    } else {
        emailInput.style.borderColor = ''; 
    }

    if (newName === currentUserData.user_name && newEmail === currentUserData.user_email) {
        alert("Изменений не обнаружено");
        return;
    }

try {
        const response = await fetch('/api/change_name_email', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_name: newName,
                user_email: newEmail
            })
        });

        // 1. Сначала извлекаем JSON данные
        const result = await response.json(); 

        if (response.status === 401) {
            alert("Сессия истекла...");
            window.location.href = '/workflow/login';
            return;
        }

        // 2. Теперь проверяем наш ключ similar из переменной result
        if (response.ok && result.status === true) {
            alert("Данные успешно обновлены!");
            currentUserData.user_name = newName;
            currentUserData.user_email = newEmail;
        } else if (result.status === false) {
            // Если бэкенд нашел дубликат
            alert("Ошибка: Это имя пользователя или email уже заняты.");
        } else {
            // Любая другая ошибка от FastAPI
            alert(`Ошибка: ${result.detail || 'Не удалось сохранить'}`);
        }
    } catch (error) {
        console.error('Ошибка при сохранении:', error);
    }
}

/**
 * Копирование ID пользователя
 */
function copyId() {
    const idInput = document.getElementById('user-id');
    if (!idInput) return;

    idInput.select();
    idInput.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(idInput.value);

    const btn = document.querySelector('.btn-copy');
    if (btn) {
        const svg = btn.querySelector('svg');
        const originalStroke = svg.style.stroke;
        const originalBorder = btn.style.borderColor;

        svg.style.stroke = '#34d399';
        btn.style.borderColor = '#34d399';

        setTimeout(() => {
            svg.style.stroke = originalStroke;
            btn.style.borderColor = originalBorder;
        }, 1500);
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    // Загружаем данные
    loadUserData();

    // Находим кнопку выхода и вешаем событие
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const openBtn = document.querySelector('.menu-toggle-btn');
    
    // 1. Создаем оверлей, если его еще нет
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    // 2. Функция ОТКРЫТИЯ
    const openMenu = () => {
        sidebar.classList.add('active');
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden'; // Запрещаем скролл сайта
    };

    // 3. Функция ЗАКРЫТИЯ
    const closeMenu = () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('show');
        document.body.style.overflow = ''; // Возвращаем скролл
    };

    // Вешаем события
    if (openBtn) {
        openBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Чтобы клик не летел дальше
            openMenu();
        });
    }

    // Клик по оверлею — СТРОГО закрытие
    overlay.addEventListener('click', closeMenu);
    
    // Закрытие при клике на ссылки
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', closeMenu);
    });
});