let carData;

fetch('/cars.json')
    .then(response => response.json())
    .then(data => {
        carData = data;
        setupEventHandlers();
    })
    .catch(error => console.error('Ошибка при загрузке данных:', error));

function setupEventHandlers() {
    const brandInput = document.getElementById('brand');
    if (brandInput) {
        brandInput.addEventListener('focus', function() {
            const brandValue = this.value.toLowerCase();
            handleBrandInput(brandValue);
        });
    } else {
        console.error('Элемент с id="brand" не найден на странице.');
    }

    const modelInput = document.getElementById('model');
    if (modelInput) {
        modelInput.addEventListener('focus', function() {
            const modelValue = this.value.toLowerCase();
            handleModelInput(modelValue);
        });
    } else {
        console.error('Элемент с id="model" не найден на странице.');
    }

    document.addEventListener('click', function(event) {
        const modelAutocomplete = document.getElementById('model-autocomplete');
        const modelInput = document.getElementById('model');

        if (event.target !== modelInput && !modelAutocomplete.contains(event.target)) {
            modelAutocomplete.innerHTML = ''; // Закрываем список моделей
        }
    });

    document.addEventListener('click', function(event) {
        const brandAutocomplete = document.getElementById('brand-autocomplete');
        const brandInput = document.getElementById('brand');

        if (event.target !== brandInput && !brandAutocomplete.contains(event.target)) {
            brandAutocomplete.innerHTML = ''; // Закрываем список брендов
        }
    });
}

function handleBrandInput(input) {
    const autocompleteContainer = document.getElementById('brand-autocomplete');
    autocompleteContainer.innerHTML = '';

    if (!input) {
        return;
    }

    const filteredBrands = carData.filter(brand => brand.name.toLowerCase().includes(input));

    filteredBrands.forEach(brand => {
        const option = document.createElement('div');
        option.textContent = brand.name;
        option.onclick = function() {
            document.getElementById('brand').value = brand.name;
            populateModels(brand.id); // Здесь вызывается функция для заполнения моделей по выбранной марке
            autocompleteContainer.innerHTML = '';
        };
        autocompleteContainer.appendChild(option);
    });
}

function handleModelInput(input) {
    const autocompleteContainer = document.getElementById('model-autocomplete');
    autocompleteContainer.innerHTML = '';

    const brandInput = document.getElementById('brand').value;
    const selectedBrand = carData.find(brand => brand.name.toLowerCase() === brandInput.toLowerCase());

    if (!selectedBrand) {
        return;
    }

    const filteredModels = selectedBrand.models.filter(model =>
        model.name.toLowerCase().includes(input)
    );

    filteredModels.forEach(model => {
        const option = document.createElement('div');
        option.textContent = model.name;
        option.onclick = function() {
            document.getElementById('model').value = model.name;
            populateYears(model['year-from']);
            autocompleteContainer.innerHTML = '';
        };
        autocompleteContainer.appendChild(option);
    });
}

function populateModels(brandId) {
    const brandSelect = document.getElementById('brand');
    const modelSelect = document.getElementById('model');
    modelSelect.innerHTML = '';

    const selectedBrandObj = carData.find(brand => brand.id === brandId);

    selectedBrandObj.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        modelSelect.appendChild(option);
    });

    populateYears(selectedBrandObj.models[0]['year-from']);
}

function populateYears(startYear) {
    const yearSelect = document.getElementById('year');
    yearSelect.innerHTML = '';

    const currentYear = new Date().getFullYear();

    startYear = startYear || 1908;

    for (let year = startYear; year <= currentYear; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/auth-status');
        const data = await response.json();
        const authButton = document.getElementById('auth-button');
        if (data.loggedIn) {
            authButton.textContent = 'Выйти';
            authButton.onclick = () => location.href = '/logout';
        } else {
            authButton.textContent = 'Войти';
            authButton.onclick = () => location.href = '/login';
        }
    } catch (err) {
        console.error('Ошибка при проверке статуса авторизации:', err);
    }
}

document.addEventListener('DOMContentLoaded', checkAuthStatus);

document.addEventListener('mousemove', (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * 15;
    const y = (event.clientY / window.innerHeight - 0.5) * 15;
    document.body.style.setProperty('--bg-x', `${x}px`);
    document.body.style.setProperty('--bg-y', `${y}px`);
});
