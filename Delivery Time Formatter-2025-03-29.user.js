// ==UserScript==
// @name         Delivery Time Formatter
// @namespace    http://tampermonkey.net/
// @version      2025-03-29
// @description  добавляет день недели и скорректированное время доставки с учётом точного прибавления часов и рабочих дней как в системе ABCP
// @author       You
// @match        https://cp.abcp.ru/distributor/1776633/routes/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=abcp.ru
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const deliveryBlockSelector = '.NJV12n7987-SSyxl';
  const outputClass = 'delivery-extra-info';

  function getSelectedRequestDate() {
    const activeDayBtn = document.querySelector('._2SgtGgcqxdDoZ6cm._22rhwUSmSd_sD23U');
    const timeInput = document.querySelector('input[name="deadline.byShipmentSchedule.requestTime"]');
    if (!activeDayBtn || !timeInput) return null;

    const daysMap = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const selectedDay = activeDayBtn.textContent.trim();
    const dayIndex = daysMap.indexOf(selectedDay);
    if (dayIndex === -1) return null;

    const now = new Date();
    const currentDay = (now.getDay() + 6) % 7; // Пн = 0
    const daysOffset = (dayIndex - currentDay + 7) % 7;

    const [hours, minutes] = timeInput.value.split(':').map(Number);
    const base = new Date(now);
    base.setDate(now.getDate() + daysOffset);
    base.setHours(hours, minutes, 0, 0);

    return base;
  }

  function isWeekend(date) {
    const day = date.getDay();
    return day === 6 || day === 0;
  }

  function moveToNextWorkday(date) {
    while (isWeekend(date)) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  function normalizeTime(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();

    if (hours > 18 || (hours === 18 && minutes > 0)) {
      date.setDate(date.getDate() + 1);
      date = moveToNextWorkday(date);
      date.setHours(10, 0, 0, 0);
    } else if (hours === 18 && minutes === 0) {
      date.setHours(19, 0, 0, 0);
    } else if (hours >= 9 && minutes > 0) {
      date.setHours(hours + 1, 0, 0, 0);
    }

    if (isWeekend(date)) {
      date = moveToNextWorkday(date);
      date.setHours(10, 0, 0, 0);
    }

    return date;
  }

  function getDeliveryDate(text) {
    const match = text.match(/(\d+)\s*дн.*?(\d+)\s*ч/);
    if (!match) return null;

    const baseDate = getSelectedRequestDate();
    if (!baseDate) return null;

    const days = parseInt(match[1]);
    const hours = parseInt(match[2]);
    const totalHours = days * 24 + hours;

    const deliveryDate = new Date(baseDate.getTime() + totalHours * 3600000);
    return normalizeTime(deliveryDate);
  }

  function getWeekdayName(date) {
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    return days[date.getDay()];
  }

  function getTimeString(date) {
    return date.toTimeString().split(':').slice(0, 2).join(':');
  }

  function updateDeliveryInfo() {
    const deliveryBlock = document.querySelector(deliveryBlockSelector);
    if (!deliveryBlock) return;

    const existing = deliveryBlock.parentElement.querySelector(`.${outputClass}`);
    if (existing) existing.remove();

    const deliveryDate = getDeliveryDate(deliveryBlock.textContent);
    if (!deliveryDate) return;

    const dayName = getWeekdayName(deliveryDate);
    const timeStr = getTimeString(deliveryDate);

    const infoSpan = document.createElement('span');
    infoSpan.className = outputClass;
    infoSpan.style.marginLeft = '10px';
    infoSpan.style.color = '#888';
    infoSpan.textContent = `(${dayName}, ${timeStr})`;

    deliveryBlock.parentElement.appendChild(infoSpan);
  }

  const observer = new MutationObserver(() => {
    updateDeliveryInfo();
  });

  const interval = setInterval(() => {
    const deliveryBlock = document.querySelector(deliveryBlockSelector);
    if (deliveryBlock) {
      updateDeliveryInfo();
      observer.observe(deliveryBlock, { childList: true, characterData: true, subtree: true });
      clearInterval(interval);
    }
  }, 500);
})();