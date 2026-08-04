import type { CrudField } from "../molecules/CrudForm/CrudForm.js";
import type {
  CheckoutItem,
  CheckoutPageLabels,
} from "../organisms/CheckoutPage/CheckoutPage.js";
import type { CheckoutSuccessAction } from "../organisms/CheckoutSuccess/CheckoutSuccess.js";

/**
 * Datos ficticios neutros para stories y specs de `CheckoutPage` y
 * `CheckoutSuccess`. Precios ya formateados: la moneda la decide la app.
 */

export const checkoutItems: CheckoutItem[] = [
  { id: "item-1", name: "Curso de inglés — nivel B1", quantity: 1, price: "120,00 €" },
  { id: "item-2", name: "Material del curso", quantity: 2, price: "30,00 €" },
  { id: "item-3", name: "Tasa de matrícula", quantity: 1, price: "25,00 €" },
];

export const checkoutTotal = "205,00 €";

export const checkoutBillingFields: CrudField[] = [
  { name: "fullName", label: "Nombre completo", required: true },
  { name: "email", label: "Correo electrónico", type: "email", required: true },
  { name: "address", label: "Dirección" },
  { name: "city", label: "Ciudad" },
  { name: "postalCode", label: "Código postal" },
  {
    name: "country",
    label: "País",
    type: "select",
    options: [
      { value: "es", label: "España" },
      { value: "fr", label: "Francia" },
      { value: "pt", label: "Portugal" },
    ],
  },
];

export const checkoutPageLabels: CheckoutPageLabels = {
  title: "Finalizar compra",
  summaryTitle: "Resumen del pedido",
  totalLabel: "Total",
  paymentTitle: "Método de pago",
  paymentFallback: "El método de pago se configura al conectar el proveedor.",
  billingTitle: "Datos de facturación",
  submitLabel: "Confirmar pago",
  cancelLabel: "Cancelar",
  processingLabel: "Procesando el pago…",
};

export const checkoutSuccessActions: CheckoutSuccessAction[] = [
  { label: "Volver al panel", href: "/panel", variant: "primary" },
  { label: "Ver factura", href: "/facturas/AB-0001" },
];
