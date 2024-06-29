let carData;

fetch('/cars.json')
    .then(response => response.json())
    .then(data => {
        carData = data;
    })
    .catch(error => console.error('Ошибка при загрузке данных:', error));

function handleBrandInput(input) {
    const autocompleteContainer = document.getElementById('brand-autocomplete');
    autocompleteContainer.innerHTML = '';

    if (!input) {
        return;
    }

    const filteredBrands = carData.filter(brand => brand.name.toLowerCase().includes(input.toLowerCase()));

    filteredBrands.forEach(brand => {
        const option = document.createElement('div');
        option.textContent = brand.name;
        option.onclick = function() {
            document.getElementById('brand').value = brand.name;
            populateModels(brand.id);
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
        model.name.toLowerCase().includes(input.toLowerCase())
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

function handleYearInput(input) {
    const autocompleteContainer = document.getElementById('year-autocomplete');
    autocompleteContainer.innerHTML = '';

    const brandInput = document.getElementById('brand').value;
    const modelInput = document.getElementById('model').value;

    if (!brandInput || !modelInput || !input) {
        return;
    }

    const selectedBrand = carData.find(brand => brand.name.toLowerCase() === brandInput.toLowerCase());
    const selectedModel = selectedBrand.models.find(model => model.name.toLowerCase() === modelInput.toLowerCase());

    if (!selectedModel) {
        return;
    }

    const startYear = selectedModel['year-from'];
    const currentYear = new Date().getFullYear();

    for (let year = startYear; year <= currentYear; year++) {
        const option = document.createElement('div');
        option.textContent = year;
        option.onclick = function() {
            document.getElementById('year').value = year;
            autocompleteContainer.innerHTML = '';
        };
        autocompleteContainer.appendChild(option);
    }
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
