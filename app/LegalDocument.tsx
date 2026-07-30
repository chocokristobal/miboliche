"use client";

import { ShieldCheck, X } from "lucide-react";

export type LegalDocumentType = "terms" | "privacy";

type LegalDocumentProps = {
  type: LegalDocumentType;
  onClose: () => void;
};

const updatedAt = "30 de julio de 2026";

export default function LegalDocument({ type, onClose }: LegalDocumentProps) {
  const isTerms = type === "terms";

  return (
    <div className="modal-backdrop legal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal legal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-document-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">MI BOLICHE · ACTUALIZADO EL {updatedAt.toUpperCase()}</span>
            <h2 id="legal-document-title">{isTerms ? "Términos de uso" : "Política de privacidad"}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Cerrar documento" onClick={onClose}>
            <X size={23} />
          </button>
        </div>

        <div className="legal-content">
          <div className="legal-intro">
            <ShieldCheck size={25} />
            <p>
              Este documento explica en lenguaje simple las reglas y cuidados aplicables al uso de Mi Boliche.
            </p>
          </div>

          {isTerms ? (
            <>
              <h3>1. Qué es Mi Boliche</h3>
              <p>Mi Boliche es una plataforma de apoyo para registrar ventas, inventario, caja, gastos, metas y reportes de gestión de almacenes y minimarkets.</p>

              <h3>2. Uso de la cuenta</h3>
              <p>La persona usuaria debe entregar información correcta, proteger su contraseña y autorizar únicamente a integrantes de su negocio. Cada cuenta es responsable de las operaciones realizadas con sus accesos.</p>

              <h3>3. Información de gestión</h3>
              <p>Los cálculos y reportes son herramientas de apoyo. No reemplazan la contabilidad, los documentos tributarios, el control legal de existencias ni la asesoría profesional.</p>

              <h3>4. Disponibilidad y respaldo</h3>
              <p>Trabajamos para mantener el servicio disponible y seguro, pero pueden existir mantenciones o interrupciones. El negocio debe conservar respaldos de la información indispensable para su operación.</p>

              <h3>5. Conductas no permitidas</h3>
              <p>No se permite intentar acceder a información de otros negocios, vulnerar la seguridad, usar el servicio con fines ilícitos ni incorporar contenido que infrinja derechos de terceros.</p>

              <h3>6. Planes, suspensión y término</h3>
              <p>Mientras los cobros estén en etapa de prueba, no se realizará ningún cargo automático. Cuando se habiliten planes pagados, el precio, período, renovación y forma de cancelación deberán mostrarse antes de contratar. Una cuenta puede suspenderse por incumplimiento, preservando sus datos según la política informada.</p>

              <h3>7. Cambios y contacto</h3>
              <p>Los cambios relevantes se informarán antes de entrar en vigencia. Las consultas pueden enviarse mediante la sección Soporte técnico disponible dentro de la plataforma.</p>
            </>
          ) : (
            <>
              <h3>1. Datos que tratamos</h3>
              <p>Podemos tratar datos de identificación y contacto de la cuenta, datos del negocio, integrantes autorizados, productos, ventas, inventario, caja, gastos, metas, tickets de soporte y registros técnicos de seguridad.</p>

              <h3>2. Para qué los usamos</h3>
              <p>Usamos la información para prestar el servicio, autenticar usuarios, mostrar reportes, prevenir accesos indebidos, responder solicitudes de soporte y mantener la continuidad de la plataforma.</p>

              <h3>3. Separación entre negocios</h3>
              <p>Cada negocio accede únicamente a la información asociada a sus integrantes autorizados. Los controles de acceso buscan impedir que una cuenta consulte o modifique datos de otro negocio.</p>

              <h3>4. Proveedores tecnológicos</h3>
              <p>Mi Boliche utiliza proveedores de infraestructura, autenticación y almacenamiento que procesan información para operar la plataforma. No vendemos bases de datos personales.</p>

              <h3>5. Conservación y seguridad</h3>
              <p>La información se conserva mientras la cuenta esté activa y por el tiempo razonablemente necesario para seguridad, respaldo y cumplimiento de obligaciones aplicables. Se aplican controles de acceso y trazabilidad, sin que ningún sistema pueda garantizar riesgo cero.</p>

              <h3>6. Tus solicitudes</h3>
              <p>Puedes solicitar acceso, corrección o eliminación de datos personales mediante Soporte técnico. Algunas operaciones pueden conservarse cuando exista una obligación legal, contractual o de seguridad que lo justifique.</p>

              <h3>7. Datos sensibles y menores de edad</h3>
              <p>La plataforma no está diseñada para almacenar datos sensibles ni para ser contratada por menores de edad. No ingreses información innecesaria en descripciones o tickets.</p>

              <h3>8. Actualizaciones</h3>
              <p>Si esta política cambia de manera importante, se informará en la plataforma y se actualizará la fecha indicada al comienzo.</p>
            </>
          )}

          <div className="legal-warning">
            Antes de activar cobros comerciales debe completarse este documento con la razón social o nombre del proveedor, RUT, domicilio y canal formal de contacto.
          </div>
        </div>
      </section>
    </div>
  );
}
