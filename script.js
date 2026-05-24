$(document).ready(function () {
    // API endpoint for real-time exchange rates
    const API_URL = 'https://open.er-api.com/v6/latest/';
    
    // Store exchange rates
    let exchangeRates = {};
    // Flag to indicate whether initial rates have been loaded
    let ratesLoaded = false;
    // Track last updated time
    let lastUpdatedTime = null;
    
    // Recent conversions history
    let recentConversions = JSON.parse(localStorage.getItem('recentConversions')) || [];

    // Initialize
    init();

    function init() {
        // Load initial exchange rates
        fetchExchangeRates($('#fromCurrency').val());
        
        // Display recent conversions
        displayRecentConversions();
        
        // Event listeners
        $('#convertBtn').on('click', convertCurrency);
        $('#copyResultBtn').on('click', copyResultToClipboard);
        $('#amount').on('input', debounce(convertCurrency, 250));

        // Theme toggle
        initTheme();
        $('#themeToggle').on('change', toggleTheme);
        // Update online status and listen for changes
        updateOnlineStatus();
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        
        $('#fromCurrency').on('change', function () {
            fetchExchangeRates($(this).val());
        });
        
        $('#toCurrency').on('change', convertCurrency);
        
        $('#swapBtn').on('click', swapCurrencies);
        $('#clearHistoryBtn').on('click', clearRecentConversions);
    }

    /**
     * Update online/offline status pill
     */
    function updateOnlineStatus() {
        const isOnline = navigator.onLine;
        const $pill = $('#onlineStatus');
        if (isOnline) {
            $pill.removeClass('offline').addClass('online').text('Online');
        } else {
            $pill.removeClass('online').addClass('offline').text('Offline');
        }
    }

    /**
     * Show a temporary toast message
     * @param {string} msg
     */
    function showToast(msg) {
        const $t = $('<div>').addClass('toast').text(msg);
        $('body').append($t);
        setTimeout(function () {
            $t.fadeOut(300, function () { $t.remove(); });
        }, 1600);
    }

    /**
     * Initialize theme based on saved preference
     */
    function initTheme() {
        const saved = localStorage.getItem('theme') || 'light';
        if (saved === 'dark') {
            $('body').addClass('dark-mode');
            $('#themeToggle').prop('checked', true);
        } else {
            $('body').removeClass('dark-mode');
            $('#themeToggle').prop('checked', false);
        }
    }

    /**
     * Toggle theme and persist preference
     */
    function toggleTheme() {
        const enabled = $('#themeToggle').is(':checked');
        if (enabled) {
            $('body').addClass('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            $('body').removeClass('dark-mode');
            localStorage.setItem('theme', 'light');
        }
    }

    /**
     * Fetch exchange rates for the selected currency using AJAX
     * @param {string} baseCurrency - The base currency code
     */
    function fetchExchangeRates(baseCurrency) {
        showLoading(true);
        hideError();
        
        $.ajax({
            url: API_URL + baseCurrency,
            type: 'GET',
            dataType: 'json',
            timeout: 5000,
            success: function (data) {
                if (data.result === 'success') {
                    exchangeRates = data.rates;
                    ratesLoaded = true;
                    // mark update time and refresh label
                    lastUpdatedTime = new Date();
                    updateLastUpdatedLabel();
                    showLoading(false);
                    convertCurrency();
                } else {
                    showError('Failed to fetch exchange rates');
                    showLoading(false);
                }
            },
            error: function (xhr, status, error) {
                console.error('AJAX Error:', error);
                showError('Unable to fetch exchange rates. Please check your internet connection.');
                showLoading(false);
            }
        });
    }

    /**
     * Convert currency based on selected values
     */
    function convertCurrency() {
        const amount = parseFloat($('#amount').val()) || 0;
        const fromCurrency = $('#fromCurrency').val();
        const toCurrency = $('#toCurrency').val();
        
        // Validate input
        if (amount < 0) {
            showError('Amount must be a positive number');
            return;
        }
        
        if (!exchangeRates || !exchangeRates[toCurrency]) {
            if (!ratesLoaded) {
                // Rates not loaded yet — fetch and defer showing an error
                fetchExchangeRates(fromCurrency);
                return;
            }
            showError('Exchange rate not available');
            return;
        }
        
        // Calculate converted amount
        const convertedAmount = amount * exchangeRates[toCurrency];
        const rate = exchangeRates[toCurrency];
        
        // Update result
        $('#result').text(convertedAmount.toFixed(2));
        $('#exchangeRate').text(`1 ${fromCurrency} = ${rate.toFixed(4)} ${toCurrency}`);
        
        // Add to recent conversions
        if (amount > 0) {
            addToRecentConversions(amount, fromCurrency, convertedAmount, toCurrency, rate);
        }
        
        hideError();
    }

    /**
     * Swap currencies
     */
    function swapCurrencies() {
        const fromCurrency = $('#fromCurrency').val();
        const toCurrency = $('#toCurrency').val();
        
        $('#fromCurrency').val(toCurrency);
        $('#toCurrency').val(fromCurrency);
        
        // Fetch new exchange rates and convert
        fetchExchangeRates(toCurrency);
    }

    /**
     * Add conversion to recent history
     * @param {number} amount - Original amount
     * @param {string} fromCurrency - Source currency
     * @param {number} convertedAmount - Converted amount
     * @param {string} toCurrency - Target currency
     * @param {number} rate - Exchange rate
     */
    function addToRecentConversions(amount, fromCurrency, convertedAmount, toCurrency, rate) {
        const conversion = {
            id: Date.now(),
            amount: amount.toFixed(2),
            fromCurrency: fromCurrency,
            convertedAmount: convertedAmount.toFixed(2),
            toCurrency: toCurrency,
            rate: rate.toFixed(4),
            timestamp: new Date().toLocaleTimeString()
        };
        
        // Add to beginning of array
        recentConversions.unshift(conversion);
        
        // Keep only last 10 conversions
        if (recentConversions.length > 10) {
            recentConversions.pop();
        }
        
        // Save to localStorage
        localStorage.setItem('recentConversions', JSON.stringify(recentConversions));
        
        // Update display
        displayRecentConversions();
    }

    /**
     * Display recent conversions from history
     */
    function displayRecentConversions() {
        const $list = $('#recentList');
        $list.empty();
        
        if (recentConversions.length === 0) {
            $list.html('<li>No conversions yet</li>');
            return;
        }
        
        recentConversions.forEach(function (conversion) {
            const $item = $('<li>').html(
                `<strong>${conversion.amount} ${conversion.fromCurrency}</strong> → ` +
                `<strong>${conversion.convertedAmount} ${conversion.toCurrency}</strong> ` +
                `<small>(${conversion.rate} @ ${conversion.timestamp})</small>`
            );
            $list.append($item);
        });
    }

    /**
     * Clear the recent conversion history
     */
    function clearRecentConversions() {
        recentConversions = [];
        localStorage.removeItem('recentConversions');
        displayRecentConversions();
    }

    /**
     * Show loading spinner and disable inputs
     * @param {boolean} show - Whether to show or hide the spinner
     */
    function showLoading(show) {
        if (show) {
            $('#loadingSpinner').show();
            $('#convertBtn').prop('disabled', true);
            $('#amount').prop('disabled', true);
            $('#fromCurrency').prop('disabled', true);
            $('#toCurrency').prop('disabled', true);
            $('#swapBtn').prop('disabled', true);
        } else {
            $('#loadingSpinner').hide();
            $('#convertBtn').prop('disabled', false);
            $('#amount').prop('disabled', false);
            $('#fromCurrency').prop('disabled', false);
            $('#toCurrency').prop('disabled', false);
            $('#swapBtn').prop('disabled', false);
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    function showError(message) {
        const $errorMsg = $('#errorMsg');
        $errorMsg.text(message).addClass('show');
    }

    /**
     * Hide error message
     */
    function hideError() {
        const $errorMsg = $('#errorMsg');
        $errorMsg.removeClass('show');
    }

    /**
     * Update the last-updated label every minute
     */
    function updateLastUpdatedLabel() {
        if (!lastUpdatedTime) {
            $('#lastUpdated').text('Updated just now');
            return;
        }
        const diffMinutes = Math.round((Date.now() - lastUpdatedTime.getTime()) / 60000);
        $('#lastUpdated').text(diffMinutes === 0 ? 'Updated just now' : `Updated ${diffMinutes} min${diffMinutes > 1 ? 's' : ''} ago`);
        // schedule next update
        setTimeout(updateLastUpdatedLabel, 60000);
    }

    function copyResultToClipboard() {
        const result = $('#result').text();
        const amount = $('#amount').val() || '0';
        const from = $('#fromCurrency').val();
        const to = $('#toCurrency').val();
        const text = `${amount} ${from} = ${result} ${to}`;
        navigator.clipboard.writeText(text).then(function () {
            showToast('Copied to clipboard');
        }).catch(function () {
            showError('Unable to copy');
        });
    }

    /**
     * Debounce helper to limit rapid calls while typing
     */
    function debounce(fn, wait) {
        let timeout;
        return function () {
            const ctx = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function () {
                fn.apply(ctx, args);
            }, wait);
        };
    }
});
