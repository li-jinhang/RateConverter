const DEFAULT_CURRENCIES = ["CNY", "USD", "EUR", "JPY", "GBP", "HKD", "AUD", "CAD", "SGD"];
const API_KEY = "YOUR_API_KEY_HERE";

const form = document.querySelector("#converter-form");
const amountInput = document.querySelector("#amount");
const fromCurrencySelect = document.querySelector("#from-currency");
const toCurrencySelect = document.querySelector("#to-currency");
const swapButton = document.querySelector("#swap-btn");
const resultValue = document.querySelector(".result-value");
const rateText = document.querySelector(".rate");
const updatedAtText = document.querySelector("#updated-at");
const statusText = document.querySelector("#status");

const state = {
  base: "CNY",
  rates: {},
  lastUpdate: "",
  currencies: []
};

function setStatus(message, type = "") {
  statusText.textContent = message;
  statusText.className = "status";
  if (type) {
    statusText.classList.add(type);
  }
}

function buildApiUrl(baseCurrency) {
  if (API_KEY && API_KEY !== "YOUR_API_KEY_HERE") {
    return `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${baseCurrency}`;
  }
  return `https://open.er-api.com/v6/latest/${baseCurrency}`;
}

async function fetchRates(baseCurrency) {
  const response = await fetch(buildApiUrl(baseCurrency));
  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  const data = await response.json();
  const rates = data.conversion_rates ?? data.rates;
  const updatedAt = data.time_last_update_utc
    ?? (typeof data.time_last_update_unix === "number"
      ? new Date(data.time_last_update_unix * 1000).toISOString()
      : "");

  if (!rates || typeof rates !== "object") {
    throw new Error("汇率数据格式异常");
  }

  return { rates, updatedAt };
}

function populateCurrencyOptions(currencies) {
  const options = currencies
    .map((currency) => `<option value="${currency}">${currency}</option>`)
    .join("");

  fromCurrencySelect.innerHTML = options;
  toCurrencySelect.innerHTML = options;
}

function formatCurrencyAmount(value, currency) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 4
  }).format(value);
}

function convert() {
  const amount = Number(amountInput.value);
  const fromCurrency = fromCurrencySelect.value;
  const toCurrency = toCurrencySelect.value;

  if (Number.isNaN(amount) || amount < 0) {
    setStatus("请输入有效的金额", "error");
    return;
  }

  const targetRate = state.rates[toCurrency];
  if (!targetRate) {
    setStatus("目标货币汇率不可用，请稍后重试", "error");
    return;
  }

  const converted = amount * targetRate;
  resultValue.textContent = `${formatCurrencyAmount(amount, fromCurrency)} = ${formatCurrencyAmount(converted, toCurrency)}`;
  rateText.textContent = `当前汇率：1 ${fromCurrency} = ${targetRate.toFixed(6)} ${toCurrency}`;
  updatedAtText.textContent = state.lastUpdate
    ? `更新时间：${new Date(state.lastUpdate).toLocaleString("zh-CN")}`
    : "更新时间：未知";
  setStatus("已更新最新汇率", "success");
}

async function refreshRates(baseCurrency, silent = false) {
  try {
    if (!silent) {
      setStatus("正在获取最新汇率...");
    }

    const { rates, updatedAt } = await fetchRates(baseCurrency);
    state.base = baseCurrency;
    state.rates = rates;
    state.lastUpdate = updatedAt;
  } catch (error) {
    setStatus(`获取汇率失败：${error.message}`, "error");
  }
}

function swapCurrencies() {
  const from = fromCurrencySelect.value;
  const to = toCurrencySelect.value;
  fromCurrencySelect.value = to;
  toCurrencySelect.value = from;
}

function bindEvents() {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (fromCurrencySelect.value !== state.base) {
      await refreshRates(fromCurrencySelect.value, true);
    }
    convert();
  });

  fromCurrencySelect.addEventListener("change", async () => {
    await refreshRates(fromCurrencySelect.value, true);
  });

  swapButton.addEventListener("click", async () => {
    swapCurrencies();
    await refreshRates(fromCurrencySelect.value, true);
  });
}

async function init() {
  const currencies = [...DEFAULT_CURRENCIES].sort();
  state.currencies = currencies;
  populateCurrencyOptions(currencies);

  fromCurrencySelect.value = "CNY";
  toCurrencySelect.value = "USD";

  bindEvents();
  await refreshRates(fromCurrencySelect.value);
}

init();
