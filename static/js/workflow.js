// Находим поле поиска
const searchInput = document.querySelector('.search-input');

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const taskCards = document.querySelectorAll('.task-card');

        taskCards.forEach(card => {
            // Извлекаем данные из карточки
            const title = card.querySelector('.task-title').textContent.toLowerCase();
            const descriptionElement = card.querySelector('.task-description');
            const description = descriptionElement ? descriptionElement.textContent.toLowerCase() : '';

            // Проверяем, есть ли совпадение в заголовке ИЛИ описании
            const matches = title.includes(searchTerm) || description.includes(searchTerm);

            // Управляем видимостью
            if (matches) {
                card.style.display = ''; // Показываем (возвращаем дефолтный flex/block)
                card.style.opacity = '1';
            } else {
                card.style.display = 'none'; // Скрываем
            }
        });

        // Опционально: выводим надпись "Ничего не найдено", если все карточки скрыты
        updateNoResultsMessage(searchTerm);
    });
}

function updateNoResultsMessage(term) {
    const tasksList = document.getElementById('tasksList');
    let noResultsMsg = document.getElementById('no-results-message');
    
    const visibleCards = document.querySelectorAll('.task-card[style*="display: none"]').length;
    const totalCards = document.querySelectorAll('.task-card').length;

    if (totalCards > 0 && visibleCards === totalCards) {
        if (!noResultsMsg) {
            noResultsMsg = document.createElement('div');
            noResultsMsg.id = 'no-results-message';
            noResultsMsg.style.textAlign = 'center';
            noResultsMsg.style.padding = '2rem';
            noResultsMsg.style.color = '#64748b';
            noResultsMsg.innerHTML = `<i data-lucide="search-x"></i><p>По запросу "${term}" ничего не найдено</p>`;
            tasksList.appendChild(noResultsMsg);
            lucide.createIcons(); // Инициализируем иконку
        }
    } else if (noResultsMsg) {
        noResultsMsg.remove();
    }
}


async function updateStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();

        // Карточки в центре
        document.getElementById('stats-total').textContent = data.total;
        document.getElementById('stats-process').textContent = data.in_progress;
        document.getElementById('stats-important').textContent = data.important;
        document.getElementById('stats-completed').textContent = data.completed;

        // Баджи в боковом меню
        if (document.getElementById('badge-total'))     document.getElementById('badge-total').textContent = data.total;
        if (document.getElementById('badge-today'))     document.getElementById('badge-today').textContent = data.today;
        if (document.getElementById('badge-important')) document.getElementById('badge-important').textContent = data.important;
        if (document.getElementById('badge-completed')) document.getElementById('badge-completed').textContent = data.completed; // Новая строка

    } catch (error) {
        console.error('Ошибка при обновлении статистики:', error);
    }
}

// Вызываем при загрузке страницы
document.addEventListener('DOMContentLoaded', updateStats);


async function filterBySystem(type, event) {
    const tasksList = document.getElementById('tasksList');
    
    // 1. Управляем подсветкой кнопок
    const allLinks = document.querySelectorAll('.nav-btn, .category-item');
    allLinks.forEach(link => link.classList.remove('active'));
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    try {
        let url = '';
        if (type === 'today') {
            url = '/api/today_tasks';
            viewTitle.textContent = 'Задачи на сегодня'; // Меняем заголовок
        } else if (type === 'important') {
            url = '/api/special_tasks'; 
            viewTitle.textContent = 'Важные задачи';    // Меняем заголовок
        } else if (type === 'completed') {
            url = '/api/completed_tasks';
            viewTitle.textContent = 'Выполненные';      // Меняем заголовок
        }

        const response = await fetch(url);
        
        if (response.ok) {
            const data = await response.json();
            const tasks = Array.isArray(data) ? data : (data.tasks || []);

            tasksList.innerHTML = ''; 

            if (tasks.length === 0) {
                // Выводим твою красивую иконку, если на сегодня ничего нет
                tasksList.innerHTML = EMPTY_STATE_HTML;
                if (window.lucide) lucide.createIcons();
            } else {
                // Рисуем карточки задач
                tasks.forEach(task => {
                    tasksList.insertAdjacentHTML('beforeend', createTaskCardHTML(task));
                });
                if (window.lucide) lucide.createIcons();
            }
        }
    } catch (error) {
        console.error("Ошибка при загрузке задач:", error);
    }
}

// Делаем доступной для HTML
window.filterBySystem = filterBySystem;


const EMPTY_STATE_HTML = `
    <div class="empty-state">
        <div class="empty-icon">
            <i data-lucide="clipboard-check"></i>
        </div>
        <h3>Нет задач</h3>
        <p>Добавьте новую задачу, чтобы начать</p>
    </div>
`;

function updateCategoryDropdowns(categories) {
    const dropdown = document.getElementById('dropdownCategoryList');
    const triggerValue = document.querySelector('#selectCategory .current-value');
    
    if (!dropdown) return;

    // Очищаем текущий список
    dropdown.innerHTML = '';

    if (categories.length === 0) {
        dropdown.innerHTML = '<div class="select-option" data-value="">Нет категорий</div>';
        if (triggerValue) triggerValue.textContent = 'Нет категорий';
        return;
    }

    // Наполняем новыми данными
    categories.forEach((cat, index) => {
        const option = document.createElement('div');
        option.className = `select-option ${index === 0 ? 'active' : ''}`;
        option.dataset.value = cat.category_id;
        option.textContent = cat.category_name;
        
        // Не забудьте перепривязать события клика, если они у вас не делегированы
        dropdown.appendChild(option);
    });

    // Обновляем текст в "шапке" селектора на первую категорию
    if (triggerValue) {
        triggerValue.textContent = categories[0].category_name;
    }
}


async function filterByCategory(categoryId, event) {
    const tasksList = document.getElementById('tasksList');
    // 1. Находим ВООБЩЕ ВСЕ кликабельные элементы в сайдбаре
    // Добавляем через запятую все классы, которые могут быть активными
    const allLinks = document.querySelectorAll('.nav-btn, .category-item');
    
    // 2. У всех убираем серый фон
    allLinks.forEach(link => {
        link.classList.remove('active');
    });

    // 3. Добавляем фон только тому, на который нажали
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }  

    // Определяем заголовок
    if (categoryId === 'all') {
        viewTitle.textContent = 'Все задачи';
    } else {
        // Берем название категории прямо из текста кнопки/пункта, на который нажали
        const categoryName = event.currentTarget.querySelector('.category-name').textContent;
        viewTitle.textContent = categoryName;
    }

    try {
        let url = categoryId === 'all' ? '/api/get_tasks' : `/api/tasks_by_category/${categoryId}`;
        const response = await fetch(url);
        
        if (response.ok) {
            const data = await response.json();
            
            // Извлекаем массив: если data это массив — берем его, 
            // если объект — ищем в нем ключ tasks
            const tasks = Array.isArray(data) ? data : (data.tasks || []);

            tasksList.innerHTML = ''; 

            if (tasks.length === 0) {
                tasksList.innerHTML = EMPTY_STATE_HTML; // Используем наш новый шаблон
                if (window.lucide) lucide.createIcons(); // Рисуем иконку
            } else {
                tasks.forEach(task => {
                    tasksList.insertAdjacentHTML('beforeend', createTaskCardHTML(task));
                });
                if (window.lucide) lucide.createIcons();
            }
        }
    } catch (error) {
        console.error("Ошибка фильтрации:", error);
    }
}


// Эти переменные и функции должны быть видны всему файлу
let taskToDelete = null;
let categoryToDelete = null; // Добавляем переменную для категории
let typeToDelete = null;     // 'task' или 'category'

// Универсальная функция открытия модалки удаления
function openDeleteModal(id, type) {
    const modal = document.getElementById('deleteModal');
    const modalTitle = modal.querySelector('h3');
    const modalText = modal.querySelector('p');
    
    if (type === 'task') {
        taskToDelete = id;
        typeToDelete = 'task';
        modalTitle.innerText = 'Удалить задачу?';
        modalText.innerText = 'Это действие нельзя будет отменить.';
    } else {
        categoryToDelete = id;
        typeToDelete = 'category';
        modalTitle.innerText = 'Удалить категорию?';
        modalText.innerText = 'Все задачи в ней останутся без категории.';
    }

    modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}

// Теперь deleteTask просто вызывает общую модалку
async function deleteTask(taskId) {
    openDeleteModal(taskId, 'task');
}

// Теперь deleteCategory тоже просто вызывает ту же модалку
async function deleteCategory(categoryId, event) {
    if (event) event.stopPropagation();
    openDeleteModal(categoryId, 'category');
}

// Глобальный обработчик кнопки "Удалить" в модалке
// Глобальный обработчик кнопки "Удалить" в модалке
document.getElementById('confirmDelete').onclick = async () => {
    const modal = document.getElementById('deleteModal');
    
    try {
        // СЛУЧАЙ А: Удаляем задачу
        if (typeToDelete === 'task' && taskToDelete) {
            const response = await fetch(`/api/delete_task/${taskToDelete}`, { method: 'DELETE' });
            if (response.ok) {
                await updateStats();

                const card = document.querySelector(`.task-card[data-id="${taskToDelete}"]`);
                if (card) {
                    // Анимация исчезновения
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.95) translateY(-10px)';
                    
                    setTimeout(() => {
                        card.remove();
                        
                        // --- НОВАЯ ПРОВЕРКА ТУТ ---
                        const tasksList = document.getElementById('tasksList');
                        // Проверяем, остались ли еще карточки задач
                        if (tasksList && tasksList.querySelectorAll('.task-card').length === 0) {
                            tasksList.innerHTML = EMPTY_STATE_HTML;
                            if (window.lucide) lucide.createIcons();
                        }
                    }, 300);
                }
            }
        }
        // СЛУЧАЙ Б: Удаляем категорию
        else if (typeToDelete === 'category' && categoryToDelete) {
            const response = await fetch(`/api/delete_category/${categoryToDelete}`, { method: 'DELETE' });
            if (response.ok) {
                const item = document.querySelector(`.category-item[data-category-id="${categoryToDelete}"]`);
                
                // Удаляем из выпадающего списка в форме
                const dropdownOption = document.querySelector(`#selectCategory .select-option[data-value="${categoryToDelete}"]`);
                if (dropdownOption) {
                    dropdownOption.remove();
                    const currentValue = document.querySelector('#selectCategory .current-value');
                    const firstOption = document.querySelector('#selectCategory .select-option');
                    
                    if (currentValue && currentValue.textContent.trim() === dropdownOption.textContent.trim()) {
                        currentValue.textContent = firstOption ? firstOption.textContent : "Нет категорий";
                    }
                }

                const isActive = item && item.classList.contains('active');

                if (item) {
                    item.style.opacity = '0';
                    item.style.transform = 'translateX(-20px)';
                    item.style.height = '0';
                    item.style.margin = '0';
                    
                    setTimeout(() => {
                        item.remove();
                        if (isActive) {
                            filterByCategory('all');
                            const allTasksBtn = document.querySelector('.nav-btn');
                            if (allTasksBtn) allTasksBtn.classList.add('active');
                        }
                    }, 300);
                }
            }
        }
    } catch (e) { 
        console.error("Ошибка при удалении:", e); 
    }

    // В КОНЦЕ: Закрываем модалку и чистим переменные
    modal.style.display = 'none';
    taskToDelete = null;
    categoryToDelete = null;
    typeToDelete = null;
};


async function completeTask(taskId) {
    const taskCard = document.querySelector(`.task-card[data-id="${taskId}"]`);
    if (!taskCard) return;

    try {
        const response = await fetch(`/api/completed_task/${taskId}`, { method: 'POST' });
        if (response.ok) {
            const result = await response.json();
            const taskData = result.task || result; 
            // Приводим к булеву значению для надежности
            const isDone = String(taskData.task_is_completed) === 'true'; 

            const tasksList = document.getElementById('tasksList');
            
            // --- ПРОВЕРКА ТЕКУЩЕГО ФИЛЬТРА ---
            const activeBtn = document.querySelector('.nav-btn.active, .category-item.active');
            // Проверяем, нажат ли сейчас фильтр "Выполненные"
            const isLookingAtCompleted = activeBtn && activeBtn.onclick && activeBtn.onclick.toString().includes('completed');

            if (isDone) {
                // Если задачу пометили как выполненную
                taskCard.classList.add('completed');
                tasksList.appendChild(taskCard); 
            } else {
                // Если с задачи СНЯЛИ галочку (стала активной)
                taskCard.classList.remove('completed');

                if (isLookingAtCompleted) {
                    // Если мы в списке выполненных — удаляем карточку с экрана (она больше не подходит фильтру)
                    taskCard.style.opacity = '0';
                    taskCard.style.transform = 'translateX(20px)';
                    setTimeout(() => {
                        taskCard.remove();
                        // Если задач не осталось — показываем "Пусто"
                        if (tasksList.querySelectorAll('.task-card').length === 0) {
                            tasksList.innerHTML = EMPTY_STATE_HTML;
                            if (window.lucide) lucide.createIcons();
                        }
                    }, 300);
                } else {
                    // Если мы в обычном списке — просто кидаем её наверх
                    tasksList.prepend(taskCard); 
                }
            }
            
            // Обновление иконки кружочка
            const iconContainer = taskCard.querySelector('.task-check');
            if (iconContainer) {
                iconContainer.innerHTML = isDone ? '<i data-lucide="check-circle"></i>' : '<i data-lucide="circle"></i>';
                if (window.lucide) lucide.createIcons();
            }
            await updateStats();
        }
    } catch (error) { 
        console.error("Ошибка при переключении статуса:", error); 
    }
}


async function toggleSpecial(taskId) {
    const taskCard = document.querySelector(`.task-card[data-id="${taskId}"]`);
    if (!taskCard) return;

    const starBtn = taskCard.querySelector('.star-btn');

    try {
        const response = await fetch(`/api/special_task/${taskId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            await updateStats();
            
            const result = await response.json();
            const taskData = result.task || result;
            const isSpecial = String(taskData.task_is_special);

            if (isSpecial === 'true') {
                // ... твой код для активации звезды ...
                starBtn.classList.add('active');
                starBtn.innerHTML = '<i data-lucide="star" fill="currentColor"></i>';
                if (!taskCard.classList.contains('completed')) {
                    document.getElementById('tasksList').prepend(taskCard);
                }
            } else {
                // ЗАДАЧА ПЕРЕСТАЛА БЫТЬ ВАЖНОЙ
                starBtn.classList.remove('active');
                starBtn.innerHTML = '<i data-lucide="star"></i>';

                // --- ВОТ ЭТОТ БЛОК ИСПРАВЛЯЕТ БАГ ---
                // Проверяем, активна ли сейчас кнопка "Важно" в сайдбаре
                const importantBtn = document.querySelector('.nav-btn.active');
                const isLookingAtImportant = importantBtn && importantBtn.onclick && importantBtn.onclick.toString().includes('important');

                if (isLookingAtImportant) {
                    // Плавно скрываем и удаляем
                    taskCard.style.opacity = '0';
                    taskCard.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        taskCard.remove();
                        
                        // Проверка на пустоту (чтобы иконка появилась сразу)
                        const tasksList = document.getElementById('tasksList');
                        if (tasksList.querySelectorAll('.task-card').length === 0) {
                            tasksList.innerHTML = EMPTY_STATE_HTML;
                            if (window.lucide) lucide.createIcons();
                        }
                    }, 300);
                }
            }
            if (window.lucide) lucide.createIcons();
        }
    } catch (error) {
        console.error("Ошибка:", error);
    }
}

// Делаем доступной для HTML
window.toggleSpecial = toggleSpecial;
window.deleteTask = deleteTask;
window.completeTask = completeTask;

// Обработка кнопок в модальном окне
document.getElementById('cancelDelete').onclick = () => {
    document.getElementById('deleteModal').style.display = 'none';
    taskToDelete = null;
};


function createTaskCardHTML(task) {
    const isDone = task.task_is_completed === 'true' || task.task_is_completed === true;
    const isSpecial = task.task_is_special === 'true' || task.task_is_special === true;
    
    const completedClass = isDone ? 'completed' : '';
    const starClass = isSpecial ? 'active' : '';
    const iconName = isDone ? 'check-circle' : 'circle';
    const starFill = isSpecial ? 'fill="currentColor"' : '';

    const priorities = ["Низкий", "Средний", "Высокий"];
    const priorityText = priorities[task.task_important] || "Средний";
    
    const dateHTML = task.task_date ? `
        <div class="meta-item">
            <i data-lucide="calendar" class="size-xs"></i>
            <span>${task.task_date}</span>
        </div>` : '';

    return `
        <div class="task-card ${completedClass}" data-id="${task.task_id}" data-category="${task.category_id}">
            <div class="task-actions">
                <button class="action-btn star-btn ${starClass}" title="В избранное" onclick="toggleSpecial(${task.task_id})">
                    <i data-lucide="star" ${starFill}></i>
                </button>
                <button class="action-btn delete-btn" title="Удалить задачу" onclick="deleteTask(${task.task_id})">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>

            <div class="task-main">
                <button class="task-check" onclick="completeTask(${task.task_id})">
                    <i data-lucide="${iconName}"></i>
                </button>
                <div class="task-body">
                    <div class="task-header">
                        <span class="category-dot" style="background-color: ${task.category?.category_color || '#555'}"></span>
                        <h3 class="task-title">${task.task_name}</h3>
                    </div>
                    ${task.task_text ? `<p class="task-description">${task.task_text}</p>` : ''}
                    <div class="task-footer">
                        ${dateHTML}
                        <div class="meta-item priority-${task.task_important}">
                            <i data-lucide="flag" class="size-xs"></i>
                            <span>${priorityText}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}


document.addEventListener('DOMContentLoaded', () => {
    // 1. Читаем категорию от Jinja и сразу пишем в dataset
    const catSelect = document.getElementById('selectCategory');
    const activeOpt = catSelect?.querySelector('.select-option.active');
    if (activeOpt) {
        catSelect.dataset.value = activeOpt.getAttribute('data-value');
    }
    
    // 1. ИНИЦИАЛИЗАЦИЯ ИКОНОК
    if (window.lucide) {
        lucide.createIcons();
    }

    // --- НОВОВВЕДЕНИЕ: СВОРАЧИВАНИЕ КАТЕГОРИЙ ---
    const toggleBtn = document.getElementById('toggleCategories');
    const categoriesSection = document.querySelector('.categories-section');

    if (toggleBtn && categoriesSection) {
        toggleBtn.addEventListener('click', () => {
            categoriesSection.classList.toggle('collapsed');
        });
    }

    // 2. ЭЛЕМЕНТЫ ФОРМЫ (Задачи)
    const quickAddInput = document.querySelector('.quick-add-input');
    const addTaskForm = document.getElementById('addTaskForm');
    const cancelBtn = document.getElementById('cancelAdd');
    const closeBtn = document.getElementById('closeForm');
    const confirmBtn = document.getElementById('confirmAdd');

    if (quickAddInput && addTaskForm) {
        quickAddInput.addEventListener('focus', () => {
            addTaskForm.style.display = 'flex';
            document.getElementById('taskTitle').focus();
        });
    }

    const hideForm = () => {
        addTaskForm.style.display = 'none';
    };

    if (cancelBtn) cancelBtn.addEventListener('click', hideForm);
    if (closeBtn) closeBtn.addEventListener('click', hideForm);

    // 3. ЛОГИКА КАСТОМНЫХ СЕЛЕКТОРОВ (Улучшенная версия)
    document.querySelectorAll('.custom-select').forEach(select => {
        const trigger = select.querySelector('.select-trigger');
        const dropdown = select.querySelector('.select-dropdown');
        const currentText = select.querySelector('.current-value');

        if (trigger && dropdown) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.select-dropdown').forEach(d => {
                    if (d !== dropdown) d.classList.remove('show');
                });
                dropdown.classList.toggle('show');
            });
        }

        // ДЕЛЕГИРОВАНИЕ: вешаем клик на родителя (dropdown), чтобы работало для новых опций
        dropdown.addEventListener('click', (e) => {
            const option = e.target.closest('.select-option');
            if (!option) return;

            dropdown.querySelectorAll('.select-option').forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            currentText.textContent = option.textContent;
            dropdown.classList.remove('show');
            select.dataset.value = option.dataset.value;
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select')) {
            document.querySelectorAll('.select-dropdown').forEach(d => d.classList.remove('show'));
        }
    });

    // 4. ОБРАБОТКА КНОПКИ "ДОБАВИТЬ" (Задачи)
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            const titleInput = document.getElementById('taskTitle');
            const descInput = document.getElementById('taskDesc');
            const categorySelect = document.getElementById('selectCategory');
            const prioritySelect = document.getElementById('selectPriority');
            const dateInput = document.getElementById('taskDate');

            const title = titleInput.value;
            if (!title.trim()) {
                alert("Название задачи обязательно!");
                return;
            }

            const newTaskData = {
                task_name: title,
                task_text: descInput.value,
                // ИСПРАВЛЕНИЕ: Превращаем в число, если значение есть, иначе шлем null
                task_category_id: categorySelect.dataset.value ? parseInt(categorySelect.dataset.value) : null,
                task_important: parseInt(prioritySelect.dataset.value) || 0,
                task_date: dateInput.value || null
            };

            console.log("Payload:", newTaskData); // Проверь в консоли, чтобы не было пустых строк ""

            try {
                // ВОТ ЭТУ СТРОКУ ТЫ ПОТЕРЯЛ:
                const response = await fetch('/api/create_task', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newTaskData)
                });

                const result = await response.json();

                if (response.ok) {
                    const tasksList = document.getElementById('tasksList');
                    const finalTask = result.task || result; 

                    // --- ЛЕЧИМ ОШИБКИ ТУТ ---

                    // 1. Получаем ID активного фильтра (из боковой панели)
                    const activeCatItem = document.querySelector('.category-item.active, .nav-btn.active');
                    // Если активна кнопка "Все" или "Входящие", обычно там нет ID, ставим 'all'
                    const currentActiveId = activeCatItem ? activeCatItem.getAttribute('data-category-id') : 'all';

                    // 2. Получаем ID категории новой задачи (приводим к строке для верности)
                    const newTaskCatId = String(finalTask.task_category_id || ''); 
                    const filterId = String(currentActiveId || 'all');

                    console.log("Фильтр сейчас:", filterId, "Категория задачи:", newTaskCatId);

                    // 3. Проверка: Рисуем, если выбран "Все" (null/'all') ИЛИ ID совпадают
                    if (filterId === 'all' || filterId === 'null' || newTaskCatId === filterId) {
                        // Убираем заглушку "Задач нет"
                        const emptyState = tasksList.querySelector('.empty-state');
                        if (emptyState) emptyState.remove();

                        const taskHTML = createTaskCardHTML(finalTask);
                        tasksList.insertAdjacentHTML('afterbegin', taskHTML);
                        
                        if (window.lucide) lucide.createIcons();
                    } else {
                        console.log("Задача создана, но скрыта фильтром");
                    }

                    // Очищаем форму
                    hideForm();
                    titleInput.value = '';
                    descInput.value = '';
                    dateInput.value = '';

                    await updateStats();
                }
            } catch (error) {
                console.error("Ошибка сети или кода:", error);
            }
        });
    }

    // --- 5. ЛОГИКА МОДАЛЬНОГО ОКНА КАТЕГОРИЙ ---
    const catModal = document.getElementById('categoryModal');
    const openCatBtn = document.getElementById('openAddCategory');
    const closeCatBtn = document.getElementById('closeCategoryModal');
    const cancelCatBtn = document.getElementById('cancelCategory');
    const saveCatBtn = document.getElementById('saveCategory'); // Кнопка "Создать"
    const newCatInput = document.getElementById('newCategoryName');
    const previewText = document.getElementById('previewText');
    const previewDot = document.getElementById('previewDot');

    const syncPreviewColor = () => {
        const activeOption = document.querySelector('.color-option.active');
        if (activeOption && previewDot) {
            const selectedColor = activeOption.dataset.color;
            previewDot.style.backgroundColor = selectedColor;
        }
    };

    // Вызываем один раз при загрузке, чтобы красный сразу применился
    syncPreviewColor();

    // Открыть модалку
    if (openCatBtn) {
        openCatBtn.addEventListener('click', () => {
            catModal.style.display = 'flex';
            syncPreviewColor(); // И на всякий случай при каждом открытии
        });
    }

    const hideCatModal = () => {
        catModal.style.display = 'none';
    };

    if (closeCatBtn) closeCatBtn.addEventListener('click', hideCatModal);
    if (cancelCatBtn) cancelCatBtn.addEventListener('click', hideCatModal);

    window.addEventListener('click', (e) => {
        if (e.target === catModal) hideCatModal();
    });

    // Живой предпросмотр текста
    if (newCatInput) {
        newCatInput.addEventListener('input', (e) => {
            previewText.textContent = e.target.value || "Название категории";
        });
    }

    // Выбор цвета и обновление предпросмотра
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            const selectedColor = option.dataset.color;
            if (previewDot) {
                previewDot.style.backgroundColor = selectedColor;
            }
        });
    });

    // --- ОТПРАВКА КАТЕГОРИИ НА СЕРВЕР ---
    if (saveCatBtn) {
        saveCatBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            const nameValue = newCatInput.value.trim();
            if (!nameValue) {
                alert("Введите название категории");
                return;
            }

            const activeColorOption = document.querySelector('.color-option.active');
            const colorValue = activeColorOption ? activeColorOption.dataset.color : "#ef4444";

            const new_category = {
                'category_name': nameValue, 
                'category_color': colorValue
            };

            try {
                const response = await fetch('/api/create_category', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(new_category)
                });

                const result = await response.json();

                if (response.ok) {
                    hideCatModal();

                    const categoryId = result.category ? result.category.category_id : result.category_id;
                    
                    if (categoryId) {
                        // 1. Добавляем в сайдбар
                        const categoriesContainer = document.querySelector('.categories-list'); 
                        if (categoriesContainer) {
                            const newCatItem = document.createElement('div');
                            newCatItem.className = 'category-item'; 
                            newCatItem.setAttribute('data-category-id', categoryId);
                            newCatItem.onclick = (event) => filterByCategory(categoryId, event);
                            
                            newCatItem.innerHTML = `
                                <div class="category-link-group">
                                    <span class="dot" style="background-color: ${new_category.category_color}"></span>
                                    <span class="category-name">${new_category.category_name}</span>
                                </div>
                                <button class="delete-cat-btn" onclick="deleteCategory(${categoryId}, event)">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            `;
                            categoriesContainer.appendChild(newCatItem); 
                            if (window.lucide) lucide.createIcons({ root: newCatItem });
                        }

                        // 2. Добавляем в выпадающий список формы задачи
                        const selectDropdown = document.querySelector('#selectCategory .select-dropdown');
                        if (selectDropdown) {
                            const newOption = document.createElement('div');
                            newOption.className = 'select-option';
                            newOption.setAttribute('data-value', categoryId);
                            newOption.textContent = new_category.category_name;
                            
                            // Важно: так как мы используем делегирование (исправлено ниже), 
                            // нам не нужно вешать onclick на каждую новую опцию вручную.
                            selectDropdown.appendChild(newOption);
                            
                            const currentValue = document.querySelector('#selectCategory .current-value');
                            if (currentValue && (currentValue.textContent.trim() === 'Нет категорий' || !currentValue.textContent.trim())) {
                                currentValue.textContent = new_category.category_name;
                                document.getElementById('selectCategory').dataset.value = categoryId;
                            }
                        }
                    }

                    // Очистка полей после успеха
                    newCatInput.value = '';
                    previewText.textContent = "Название категории";
                } else {
                    alert(`Ошибка: ${result.detail || 'Не удалось создать категорию'}`);
                }
            } catch (error) {
                console.error("Ошибка сети:", error);
            }
        });
    }
    // Находим кнопку "Все задачи"
    const allTasksBtn = document.querySelector('.nav-btn');
    const tasksList = document.getElementById('tasksList');

    if (allTasksBtn) {
        // Имитируем клик: это загрузит данные и подсветит кнопку
        filterByCategory('all', { currentTarget: allTasksBtn });
    } else if (tasksList && tasksList.children.length === 0) {
        // Если кнопки нет, но список пуст — просто рисуем заглушку
        tasksList.innerHTML = EMPTY_STATE_HTML;
        if (window.lucide) lucide.createIcons();
    }
}); 


document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const openBtn = document.getElementById('openMenu');
    
    // Создаем фон-затемнение динамически
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    const toggleMenu = () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('show');
    };

    openBtn.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);
    
    // Закрывать при клике на пункты меню (для мобилок актуально)
    const navLinks = document.querySelectorAll('.nav-btn, .category-item');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) toggleMenu();
        });
    });
});