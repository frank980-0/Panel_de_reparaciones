// ============================================
// FIREBASE SERVICE
// ============================================

class FirebaseService {
  constructor() {
    this.db = window.db;
    this.firestore = window.firestore;
    this.collectionName = "reparaciones";
    console.log("🔥 Firebase Service inicializado");
  }

  async getReparaciones() {
    try {
      const { collection, getDocs, query, orderBy } = this.firestore;
      const q = query(
        collection(this.db, this.collectionName),
        orderBy("fecha", "desc")
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error al cargar:", error);
      return [];
    }
  }

  async crearReparacion(data) {
    try {
      const { collection, addDoc } = this.firestore;
      const ref = await addDoc(collection(this.db, this.collectionName), data);
      return { id: ref.id, ...data };
    } catch (error) {
      console.error("Error al crear:", error);
      return null;
    }
  }

  async actualizarReparacion(id, data) {
    try {
      const { doc, updateDoc } = this.firestore;
      await updateDoc(doc(this.db, this.collectionName, id), data);
      return true;
    } catch (error) {
      console.error("Error al actualizar:", error);
      return false;
    }
  }

  async eliminarReparacion(id) {
    try {
      const { doc, deleteDoc } = this.firestore;
      await deleteDoc(doc(this.db, this.collectionName, id));
      return true;
    } catch (error) {
      console.error("Error al eliminar:", error);
      return false;
    }
  }
}

// ============================================
// Panel de Reparaciones
// ============================================

class RepairDashboard {
  constructor() {
    if (!window.db) {
      alert("Firebase no inicializado");
      return;
    }

    this.api = new FirebaseService();
    this.repairs = [];

    this.dom = {
      table: document.getElementById("repairs-table"),
      alerts: document.getElementById("alerts"),
      modal: document.getElementById("repair-modal"),
    };

    this.init();
  }

  async init() {
    this.setupEvents();
    await this.refreshUI();
  }

  setupEvents() {
    document.addEventListener("click", (e) => {
      const { action, repairId, changeStatus } = e.target.dataset;

      if (action) this.handleAction(action);
      if (repairId) this.deleteRepair(repairId);
      if (changeStatus) this.changeRepairStatus(changeStatus);
    });
  }
  async changeRepairStatus(id) {
    const repair = this.repairs.find((r) => r.id === id);
    if (!repair) return;

    const nuevoEstado =
      repair.estado === "en-proceso" ? "realizado" : "en-proceso";

    const success = await this.api.actualizarReparacion(id, {
      estado: nuevoEstado,
    });

    if (success) {
      await this.refreshUI();
      this.showAlert("Estado actualizado");
    }
  }

  async refreshUI() {
    this.repairs = await this.api.getReparaciones();
    this.renderRepairs();
    this.renderStats();
  }

  renderStats() {
    let ingresos = 0,
      pendientes = 0,
      completadas = 0;

    this.repairs.forEach((r) => {
      if (r.estado === "realizado") {
        ingresos += r.precio;
        completadas++;
      } else {
        pendientes++;
      }
    });

    document.querySelector('[data-stat="ingresos"] data').textContent =
      "$" + ingresos.toLocaleString("es-AR");

    document.querySelector('[data-stat="reparaciones"] data').textContent =
      this.repairs.length;

    document.querySelector('[data-stat="pendientes"] data').textContent =
      pendientes;

    document.querySelector('[data-stat="completadas"] data').textContent =
      completadas;
  }

  renderRepairs() {
    if (!this.repairs.length) {
      this.dom.table.innerHTML = `
        <tr>
          <td colspan="7">📱 No hay reparaciones</td>
        </tr>`;
      return;
    }

    this.dom.table.innerHTML = this.repairs
      .map(
        (r, i) => `
        <tr>
          <th>#${String(i + 1).padStart(3, "0")}</th>
          <td>${r.cliente}</td>
          <td>${r.dispositivo}</td>
          <td>${r.problema}</td>
          <td>

            <data value="${r.estado}"
            data-change-status="${r.id}">
            ${r.estado === "realizado" ? "✅ Realizado" : "⏳ En Proceso"}
            </data>

          </td>
          <td>$${r.precio.toLocaleString("es-AR")}</td>
          <td>
            <button data-repair-id="${r.id}">🗑️</button>
          </td>
        </tr>
      `
      )
      .join("");
  }

  handleAction(action) {
    if (action === "addRepair") this.openModal();
    if (action === "saveRepair") this.saveRepair();
    if (action === "closeModal") this.closeModal();
  }

  openModal() {
    this.dom.modal.showModal();
  }

  closeModal() {
    this.dom.modal.querySelector("form").reset();
    this.dom.modal.close();
  }

  async saveRepair() {
    const cliente = document.getElementById("repair-client").value.trim();
    const dispositivo = document.getElementById("repair-device").value.trim();
    const problema = document.getElementById("repair-problem").value.trim();
    const precio = Number(document.getElementById("repair-price").value);
    const estado = document.getElementById("repair-status").value;

    if (!cliente || !dispositivo || !problema || isNaN(precio) || precio < 0) {
      this.showAlert("Completa todos los campos correctamente", "error");
      return;
    }

    const newRepair = {
      cliente,
      dispositivo,
      problema,
      precio,
      estado,
      fecha: new Date().toISOString(),
    };

    const result = await this.api.crearReparacion(newRepair);

    if (result) {
      await this.refreshUI();
      this.dom.modal.close();

      this.showAlert("✅ Guardado correctamente", "success");
    } else {
      this.showAlert("❌ Error al guardar", "error");
    }
  }

  async deleteRepair(id) {
    if (!confirm("¿Eliminar reparación?")) return;

    if (await this.api.eliminarReparacion(id)) {
      await this.refreshUI();
      this.showAlert("Reparación eliminada");
    }
  }

  showAlert(msg, type = "success") {
    this.dom.alerts.textContent = msg;
    this.dom.alerts.dataset.type = type;
    this.dom.alerts.style.display = "block";

    setTimeout(() => {
      this.dom.alerts.style.display = "none";
    }, 3000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new RepairDashboard();
});
