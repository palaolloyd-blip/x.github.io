document.addEventListener('DOMContentLoaded', () => {
    // State Management
    let clients = JSON.parse(localStorage.getItem('event_sync_clients')) || [];
    let currentClientId = null; // Currently viewed client in details modal
    let deleteTarget = null; // { type: 'client'|'checklist', id, clientId }

    // DOM Elements - Main View
    const clientsTableBody = document.getElementById('clientsTableBody');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const openAddClientModalBtn = document.getElementById('openAddClientModalBtn');
    
    // Metrics
    const totalClientsCount = document.getElementById('totalClientsCount');
    const completedClientsCount = document.getElementById('completedClientsCount');
    const ongoingClientsCount = document.getElementById('ongoingClientsCount');
    const redClientsCount = document.getElementById('redClientsCount');

    // DOM Elements - Client Modal
    const clientModal = document.getElementById('clientModal');
    const clientModalTitle = document.getElementById('clientModalTitle');
    const clientForm = document.getElementById('clientForm');
    const clientIdField = document.getElementById('clientIdField');
    const clientNameInput = document.getElementById('clientNameInput');
    const eventTypeInput = document.getElementById('eventTypeInput');
    const eventDateInput = document.getElementById('eventDateInput');
    const venueInput = document.getElementById('venueInput');
    const closeClientModalBtn = document.getElementById('closeClientModalBtn');
    const cancelClientBtn = document.getElementById('cancelClientBtn');

    // DOM Elements - Details Modal
    const detailsModal = document.getElementById('detailsModal');
    const closeDetailsModalBtn = document.getElementById('closeDetailsModalBtn');
    const detailsClientName = document.getElementById('detailsClientName');
    const detailsEventMeta = document.getElementById('detailsEventMeta');
    const detailsOverallBadge = document.getElementById('detailsOverallBadge');
    const openAddChecklistBtn = document.getElementById('openAddChecklistBtn');
    const checklistTableBody = document.getElementById('checklistTableBody');

    // DOM Elements - Checklist Item Modal
    const checklistModal = document.getElementById('checklistModal');
    const checklistModalTitle = document.getElementById('checklistModalTitle');
    const checklistForm = document.getElementById('checklistForm');
    const checklistItemIdField = document.getElementById('checklistItemIdField');
    const checklistCategoryInput = document.getElementById('checklistCategoryInput');
    const checklistItemNameInput = document.getElementById('checklistItemNameInput');
    const checklistNotesInput = document.getElementById('checklistNotesInput');
    const checklistDueDateInput = document.getElementById('checklistDueDateInput');
    const closeChecklistModalBtn = document.getElementById('closeChecklistModalBtn');
    const cancelChecklistBtn = document.getElementById('cancelChecklistBtn');

    // DOM Elements - Confirm Dialog
    const confirmModal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmYesBtn = document.getElementById('confirmYesBtn');
    const confirmNoBtn = document.getElementById('confirmNoBtn');

    // Backup / Restore Elements
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    const toastContainer = document.getElementById('toastContainer');

    // Initialization
    initApp();
    setupEventListeners();

    function initApp() {
        verifyAndMigrateData();
        renderDashboard();
        renderClientsTable();
    }

    // Migration rule: ensure every client and checklist item has a valid status, defaulting to RED if missing.
    function verifyAndMigrateData() {
        let updated = false;
        clients.forEach(client => {
            if (!client.status) {
                client.status = 'RED';
                updated = true;
            }
            if (!client.checklist) client.checklist = [];
            client.checklist.forEach(item => {
                if (!item.status) {
                    item.status = 'RED';
                    updated = true;
                }
            });
            recalculateClientStatus(client);
        });
        if (updated) saveToLocalStorage();
    }

    // --- Recalculation Rules ---
    function recalculateClientStatus(client) {
        const items = client.checklist || [];
        if (items.length === 0) {
            client.status = 'RED';
            return;
        }
        const allGreen = items.every(i => i.status === 'GREEN');
        const hasOrange = items.some(i => i.status === 'ORANGE');
        const allRed = items.every(i => i.status === 'RED');

        if (allGreen) {
            client.status = 'GREEN';
        } else if (hasOrange || items.some(i => i.status === 'GREEN')) {
            client.status = 'ORANGE';
        } else if (allRed) {
            client.status = 'RED';
        } else {
            client.status = 'ORANGE';
        }
    }

    function getProgressData(client) {
        const items = client.checklist || [];
        const total = items.length;
        if (total === 0) return { percent: 0, greenCount: 0, total: 0 };
        const greenCount = items.filter(i => i.status === 'GREEN').length;
        const percent = Math.round((greenCount / total) * 100);
        return { percent, greenCount, total };
    }

    // --- Rendering Functions ---
    function renderDashboard() {
        totalClientsCount.textContent = clients.length;
        completedClientsCount.textContent = clients.filter(c => c.status === 'GREEN').length;
        ongoingClientsCount.textContent = clients.filter(c => c.status === 'ORANGE').length;
        redClientsCount.textContent = clients.filter(c => c.status === 'RED').length;
    }

    function renderClientsTable() {
        const query = searchInput.value.toLowerCase().trim();
        const filterStatus = statusFilter.value;

        clientsTableBody.innerHTML = '';

        const filtered = clients.filter(c => {
            const matchesQuery = !query || 
                c.name.toLowerCase().includes(query) || 
                c.eventType.toLowerCase().includes(query) || 
                (c.venue && c.venue.toLowerCase().includes(query)) ||
                c.id.toLowerCase().includes(query);
            const matchesStatus = !filterStatus || c.status === filterStatus;
            return matchesQuery && matchesStatus;
        });

        if (filtered.length === 0) {
            clientsTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">No client records found.</td></tr>`;
            return;
        }

        filtered.forEach(c => {
            const prog = getProgressData(c);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code>${c.id}</code></td>
                <td><strong>${escapeHtml(c.name)}</strong></td>
                <td>${escapeHtml(c.eventType)}</td>
                <td>${c.eventDate || 'N/A'}</td>
                <td>${escapeHtml(c.venue || 'N/A')}</td>
                <td>
                    <select class="status-select ${c.status.toLowerCase()}" data-client-id="${c.id}">
                        <option value="RED" ${c.status === 'RED' ? 'selected' : ''}>🔴 RED — Not Done</option>
                        <option value="ORANGE" ${c.status === 'ORANGE' ? 'selected' : ''}>🟠 ORANGE — Ongoing</option>
                        <option value="GREEN" ${c.status === 'GREEN' ? 'selected' : ''}>🟢 GREEN — Done</option>
                    </select>
                </td>
                <td>
                    <div class="progress-container">
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${prog.percent}%"></div>
                        </div>
                        <span class="progress-text">${prog.percent}%</span>
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary view-btn" data-id="${c.id}"><i class="fa-solid fa-eye"></i> View</button>
                        <button class="btn btn-secondary edit-client-btn" data-id="${c.id}"><i class="fa-solid fa-pen"></i> Edit</button>
                        <button class="btn btn-danger delete-client-btn" data-id="${c.id}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            `;

            // Event Listeners for row actions
            tr.querySelector('.status-select').addEventListener('change', (e) => {
                const newStatus = e.target.value;
                c.status = newStatus; // Manual override support
                saveToLocalStorage();
                renderDashboard();
                renderClientsTable();
                showToast(`Client overall status updated to ${newStatus}.`, 'success');
            });

            tr.querySelector('.view-btn').addEventListener('click', () => openDetailsModal(c.id));
            tr.querySelector('.edit-client-btn').addEventListener('click', () => openClientModal(c));
            tr.querySelector('.delete-client-btn').addEventListener('click', () => promptDeleteClient(c.id));

            clientsTableBody.appendChild(tr);
        });
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        searchInput.addEventListener('input', renderClientsTable);
        statusFilter.addEventListener('change', renderClientsTable);

        openAddClientModalBtn.addEventListener('click', () => openClientModal());
        closeClientModalBtn.addEventListener('click', closeClientModal);
        cancelClientBtn.addEventListener('click', closeClientModal);
        clientForm.addEventListener('submit', handleSaveClient);

        closeDetailsModalBtn.addEventListener('click', () => detailsModal.style.display = 'none');
        openAddChecklistBtn.addEventListener('click', () => openChecklistModal());

        closeChecklistModalBtn.addEventListener('click', closeChecklistModal);
        cancelChecklistBtn.addEventListener('click', closeChecklistModal);
        checklistForm.addEventListener('submit', handleSaveChecklist);

        confirmNoBtn.addEventListener('click', () => confirmModal.style.display = 'none');
        confirmYesBtn.addEventListener('click', executeConfirmedDeletion);

        // Export / Import
        exportBtn.addEventListener('click', exportJSONBackup);
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', handleImportJSON);

        // Keyboard escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                clientModal.style.display = 'none';
                detailsModal.style.display = 'none';
                checklistModal.style.display = 'none';
                confirmModal.style.display = 'none';
            }
        });
    }

    // --- Client CRUD & Photobooth Default Items ---
    function openClientModal(client = null) {
        if (client) {
            clientModalTitle.textContent = 'Edit Client Record';
            clientIdField.value = client.id;
            clientNameInput.value = client.name;
            eventTypeInput.value = client.eventType;
            eventDateInput.value = client.eventDate;
            venueInput.value = client.venue || '';
        } else {
            clientModalTitle.textContent = 'Add New Client';
            clientIdField.value = '';
            clientForm.reset();
        }
        clientModal.style.display = 'flex';
    }

    function closeClientModal() {
        clientModal.style.display = 'none';
        clientForm.reset();
    }

    function handleSaveClient(e) {
        e.preventDefault();
        const idVal = clientIdField.value;
        const name = clientNameInput.value.trim();
        const eventType = eventTypeInput.value.trim();
        const eventDate = eventDateInput.value;
        const venue = venueInput.value.trim();

        const nowStr = formatReadableDateTime(new Date());

        if (idVal) {
            // Edit
            const client = clients.find(c => c.id === idVal);
            if (client) {
                client.name = name;
                client.eventType = eventType;
                client.eventDate = eventDate;
                client.venue = venue;
                // Preserve existing status and checklist items
                saveToLocalStorage();
                initApp();
                closeClientModal();
                showToast('Client record updated successfully!', 'success');
            }
        } else {
            // Create New Client
            const newClientId = 'CL-' + Math.floor(1000 + Math.random() * 9000);
            
            // Create default checklist items (one example per category), Mandatory RED status
            const defaultChecklistItems = [
                { id: 'CHK-' + Date.now() + '-1', category: 'Throwback Pics', name: 'Throwback Pics', notes: '', dueDate: '', status: 'RED', dateAdded: nowStr, lastUpdated: nowStr },
                { id: 'CHK-' + Date.now() + '-2', category: 'Prenup (Pic)', name: 'Prenup (Pic)', notes: '', dueDate: '', status: 'RED', dateAdded: nowStr, lastUpdated: nowStr },
                { id: 'CHK-' + Date.now() + '-3', category: 'Prenup (AVP)', name: 'Prenup (AVP)', notes: '', dueDate: '', status: 'RED', dateAdded: nowStr, lastUpdated: nowStr },
                { id: 'CHK-' + Date.now() + '-4', category: 'SDE (Pic)', name: 'SDE (Pic)', notes: '', dueDate: '', status: 'RED', dateAdded: nowStr, lastUpdated: nowStr },
                { id: 'CHK-' + Date.now() + '-5', category: 'SDE (Vid)', name: 'SDE (Vid)', notes: '', dueDate: '', status: 'RED', dateAdded: nowStr, lastUpdated: nowStr },
                { id: 'CHK-' + Date.now() + '-6', category: 'Full Video', name: 'Full Video', notes: '', dueDate: '', status: 'RED', dateAdded: nowStr, lastUpdated: nowStr },
                { id: 'CHK-' + Date.now() + '-7', category: 'Ceremony Pics', name: 'Ceremony Pics', notes: '', dueDate: '', status: 'RED', dateAdded: nowStr, lastUpdated: nowStr },
                { id: 'CHK-' + Date.now() + '-8', category: 'Reception Pics', name: 'Reception Pics', notes: '', dueDate: '', status: 'RED', dateAdded: nowStr, lastUpdated: nowStr },
                { id: 'CHK-' + Date.now() + '-9', category: 'Links', name: 'Links', notes: '', dueDate: '', status: 'RED', dateAdded: nowStr, lastUpdated: nowStr },
                { id: 'CHK-' + Date.now() + '-10', category: 'Wedding Photos (Post)', name: 'Wedding Photos (Post)', notes: '', dueDate: '', status: 'RED', dateAdded: nowStr, lastUpdated: nowStr },
                { id: 'CHK-' + Date.now() + '-11', category: 'SDE Video (Post)', name: 'SDE Video (Post)', notes: '', dueDate: '', status: 'RED', dateAdded: nowStr, lastUpdated: nowStr },
                { id: 'CHK-' + Date.now() + '-12', category: 'Wedding Highlights', name: 'Wedding Highlights', notes: '', dueDate: '', status: 'RED', dateAdded: nowStr, lastUpdated: nowStr },
                { id: 'CHK-' + Date.now() + '-13', category: 'Note', name: 'Note', notes: '', dueDate: '', status: 'RED', dateAdded: nowStr, lastUpdated: nowStr }
            ];

            const newClient = {
                id: newClientId,
                name,
                eventType,
                eventDate,
                venue,
                status: 'RED', // Mandatory initial RED status
                dateAdded: nowStr,
                checklist: defaultChecklistItems
            };

            clients.push(newClient);
            saveToLocalStorage();
            initApp();
            closeClientModal();
            showToast('New client created with default checklist items (RED).', 'success');
        }
    }

    function promptDeleteClient(clientId) {
        deleteTarget = { type: 'client', id: clientId };
        confirmTitle.textContent = 'Delete Client Record';
        confirmMessage.textContent = 'Are you sure you want to delete this client? All associated checklist items will also be permanently deleted.';
        confirmModal.style.display = 'flex';
    }

    // --- Checklist CRUD & Workflow ---
    function openDetailsModal(clientId) {
        currentClientId = clientId;
        renderDetailsModalContent();
        detailsModal.style.display = 'flex';
    }

    function renderDetailsModalContent() {
        const client = clients.find(c => c.id === currentClientId);
        if (!client) return;

        detailsClientName.textContent = client.name;
        detailsEventMeta.textContent = `${client.eventType} • ${client.eventDate} • ${client.venue || 'No Venue'}`;
        
        // Update overall badge
        detailsOverallBadge.className = `badge ${client.status.toLowerCase()}`;
        detailsOverallBadge.textContent = client.status;

        checklistTableBody.innerHTML = '';
        const items = client.checklist || [];

        if (items.length === 0) {
            checklistTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No checklist items found. Click 'Add Checklist Item' to start.</td></tr>`;
            return;
        }

        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${escapeHtml(item.category)}</span></td>
                <td>
                    <strong>${escapeHtml(item.name)}</strong>
                    ${item.notes ? (item.category === 'Links' ? `<div style="font-size:0.8rem;"><a href="${escapeHtml(item.notes)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.notes)}</a></div>` : `<div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(item.notes)}</div>`) : ''}
                </td>
                <td>${item.dueDate || 'No Due Date'}</td>
                <td>
                    <select class="status-select ${item.status.toLowerCase()}" data-item-id="${item.id}">
                        <option value="RED" ${item.status === 'RED' ? 'selected' : ''}>🔴 RED — Not Done</option>
                        <option value="ORANGE" ${item.status === 'ORANGE' ? 'selected' : ''}>🟠 ORANGE — Ongoing</option>
                        <option value="GREEN" ${item.status === 'GREEN' ? 'selected' : ''}>🟢 GREEN — Done</option>
                    </select>
                </td>
                <td style="font-size: 0.8rem; color: var(--text-muted);">
                    Added: ${item.dateAdded}<br>Updated: ${item.lastUpdated}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-secondary edit-chk-btn" data-id="${item.id}"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-danger delete-chk-btn" data-id="${item.id}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            `;

            // Status change listener
            tr.querySelector('.status-select').addEventListener('change', (e) => {
                const newStatus = e.target.value;
                item.status = newStatus;
                item.lastUpdated = formatReadableDateTime(new Date());
                
                recalculateClientStatus(client);
                saveToLocalStorage();
                renderDetailsModalContent();
                renderDashboard();
                renderClientsTable();
                
                const labels = { RED: 'Not Done', ORANGE: 'Ongoing', GREEN: 'Done' };
                showToast(`Status updated to ${labels[newStatus]}.`, 'success');
            });

            tr.querySelector('.edit-chk-btn').addEventListener('click', () => openChecklistModal(item));
            tr.querySelector('.delete-chk-btn').addEventListener('click', () => promptDeleteChecklistItem(item.id));

            checklistTableBody.appendChild(tr);
        });
    }

    function openChecklistModal(item = null) {
        if (item) {
            checklistModalTitle.textContent = 'Edit Checklist Item';
            checklistItemIdField.value = item.id;
            checklistCategoryInput.value = item.category;
            checklistItemNameInput.value = item.name;
            checklistNotesInput.value = item.notes || '';
            checklistDueDateInput.value = item.dueDate || '';
        } else {
            checklistModalTitle.textContent = 'Add New Checklist Item';
            checklistItemIdField.value = '';
            checklistForm.reset();
        }
        checklistModal.style.display = 'flex';
    }

    function closeChecklistModal() {
        checklistModal.style.display = 'none';
        checklistForm.reset();
    }

    function handleSaveChecklist(e) {
        e.preventDefault();
        const client = clients.find(c => c.id === currentClientId);
        if (!client) return;

        const itemId = checklistItemIdField.value;
        const category = checklistCategoryInput.value;
        const name = checklistItemNameInput.value.trim();
        const notes = checklistNotesInput.value.trim();
        const dueDate = checklistDueDateInput.value;
        const nowStr = formatReadableDateTime(new Date());

        if (itemId) {
            // Edit existing item
            const item = client.checklist.find(i => i.id === itemId);
            if (item) {
                item.category = category;
                item.name = name;
                item.notes = notes;
                item.dueDate = dueDate;
                item.lastUpdated = nowStr;
                // Preserve original status and dateAdded
                recalculateClientStatus(client);
                saveToLocalStorage();
                initApp();
                renderDetailsModalContent();
                closeChecklistModal();
                showToast('Checklist task updated successfully.', 'success');
            }
        } else {
            // Create new item (Mandatory RED status)
            const newItem = {
                id: 'CHK-' + Date.now(),
                category,
                name,
                notes,
                dueDate,
                status: 'RED', // Mandatory default
                dateAdded: nowStr,
                lastUpdated: nowStr
            };

            if (!client.checklist) client.checklist = [];
            client.checklist.push(newItem);

            recalculateClientStatus(client);
            saveToLocalStorage();
            initApp();
            renderDetailsModalContent();
            closeChecklistModal();
            showToast('New task added with RED status.', 'success');
        }
    }

    function promptDeleteChecklistItem(itemId) {
        deleteTarget = { type: 'checklist', id: itemId, clientId: currentClientId };
        confirmTitle.textContent = 'Delete Checklist Item';
        confirmMessage.textContent = 'Are you sure you want to delete this checklist item?';
        confirmModal.style.display = 'flex';
    }

    function executeConfirmedDeletion() {
        if (!deleteTarget) return;

        if (deleteTarget.type === 'client') {
            clients = clients.filter(c => c.id !== deleteTarget.id);
            saveToLocalStorage();
            initApp();
            showToast('Client record deleted successfully.', 'success');
        } else if (deleteTarget.type === 'checklist') {
            const client = clients.find(c => c.id === deleteTarget.clientId);
            if (client) {
                client.checklist = client.checklist.filter(i => i.id !== deleteTarget.id);
                recalculateClientStatus(client);
                saveToLocalStorage();
                initApp();
                renderDetailsModalContent();
                showToast('Checklist item deleted.', 'success');
            }
        }

        confirmModal.style.display = 'none';
        deleteTarget = null;
    }

    // --- Backup & Restore ---
    function exportJSONBackup() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(clients, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", `eventsync_backup_${formatDateForFilename(new Date())}.json`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
        showToast('JSON backup exported successfully.', 'success');
    }

    function handleImportJSON(e) {
        const fileReader = new FileReader();
        if (e.target.files[0]) {
            fileReader.readAsText(e.target.files[0], "UTF-8");
            fileReader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    if (Array.isArray(importedData)) {
                        clients = importedData;
                        verifyAndMigrateData();
                        saveToLocalStorage();
                        initApp();
                        showToast('Database restored successfully from JSON.', 'success');
                    } else {
                        showToast('Invalid backup file format.', 'error');
                    }
                } catch (err) {
                    showToast('Error parsing JSON file.', 'error');
                }
                importFile.value = '';
            };
        }
    }

    // --- Storage & Utilities ---
    function saveToLocalStorage() {
        localStorage.setItem('event_sync_clients', JSON.stringify(clients));
    }

    function formatReadableDateTime(dateObj) {
        const options = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        return dateObj.toLocaleDateString('en-US', options);
    }

    function formatDateForFilename(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}${m}${d}`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/"/g, "&quot;")
                  .replace(/'/g, "&#039;");
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
});