# Análisis funcional — Control_de_Gastos.xlsx

**Archivo:** `C:\Users\zemog\Downloads\Control_de_Gastos.xlsx` (21,935 bytes)
**Método de análisis:** Automatización COM de Microsoft Excel desde PowerShell (Excel estaba instalado; Python era solo un alias de Microsoft Store sin instalación real, sin `openpyxl`/`pandas` disponibles).
**Fecha de análisis:** 2026-08-20

**Hojas encontradas (4, todas visibles, sin hojas ocultas, sin rangos con nombre definidos):**

| # | Nombre de hoja | Rango usado | Filas | Columnas |
|---|---|---|---|---|
| 1 | Mandado | B2:R46 | 45 | 17 |
| 2 | Semanal | B2:H34 | 33 | 7 |
| 3 | Mensual | B2:O30 | 29 | 14 |
| 4 | Resumen | B2:D17 | 16 | 3 |

La estructura real **coincide** con la descripción aproximada del usuario (4 módulos: Mandado, Semanal, Mensual, Resumen), con nombres de hoja exactos: `Mandado`, `Semanal`, `Mensual`, `Resumen`. El contenido está en español, orientado a una sola familia/usuario (aparecen nombres propios como "Fernando").

---

## Convenciones de color detectadas (leyendas explícitas en cada hoja)

Cada hoja incluye una fila de "Leyenda" con el código de colores usado en el diseño original:

- **Amarillo** = celda editable por el usuario (captura manual).
- **Gris cursiva** = valor de ejemplo/plantilla, editable o borrable (aparece en hoja Mandado, ej. "Tomate", "Pechuga de pollo").
- **Verde/Azul** = celda calculada por fórmula, no debe editarse manualmente.
- **Gris** = celda no aplica en esa fila (deshabilitada visualmente).

Esta convención (amarillo=input, verde/azul=fórmula/output) es la regla de UX a replicar en la app web: los campos "input" deben ser editables por el usuario; los campos "fórmula" deben ser de solo lectura y recalcularse reactivamente.

---

## Hoja 1: `Mandado`

**Propósito:** Desglose del gasto de "mandado" (canasta básica / súper) por categoría y producto, divido en 5 semanas del mes, con total mensual.

**Rango usado:** B2:R46 (45 filas × 17 columnas)

**Encabezados (fila 5-6):**
- B5: "Concepto"
- Bloques de semana en columnas agrupadas de 3: C-E = Semana 1, F-H = Semana 2, I-K = Semana 3, L-N = Semana 4, O-Q = Semana 5, R = "Total Mes"
- Sub-encabezados de fila 6 dentro de cada bloque semanal: "Cant." | "Precio" | "Subtotal" (ej. C6=Cant., D6=Precio, E6=Subtotal; se repite para cada semana)

**Texto de ayuda (B3):** "Anota Cantidad y Precio de cada producto (celdas amarillas); el Subtotal, la categoría y el Total Mandado se calculan solos y viajan a la hoja Semanal."

**Categorías (8, cada una con fila de subtotal y 3 filas de productos debajo — plantilla de 3 slots de producto por categoría):**
1. Frutas y Verduras (fila 7; productos filas 8-10)
2. Carnes y Pescados (fila 11; productos filas 12-14)
3. Lácteos y Huevo (fila 15; productos filas 16-18)
4. Granos y Abarrotes (fila 19; productos filas 20-22)
5. Pan y Tortillas (fila 23; productos filas 24-26)
6. Productos de Limpieza (fila 27; productos filas 28-30)
7. Higiene Personal (fila 31; productos filas 32-34)
8. Otros Mandado (fila 35; productos filas 36-38)

**Productos de ejemplo capturados (uno por categoría, en gris cursiva/editable, los otros 2 slots de cada categoría están vacíos pero listos para llenarse):**
- Tomate (Frutas y Verduras) — Cant=2, Precio=18 → Subtotal Semana1=36
- Pechuga de pollo (Carnes y Pescados) — Cant=1, Precio=95 → Subtotal=95
- Leche (Lácteos y Huevo) — Cant=4, Precio=25 → Subtotal=100
- Arroz (Granos y Abarrotes) — Cant=1, Precio=22 → Subtotal=22
- Tortillas (Pan y Tortillas) — Cant=2, Precio=18 → Subtotal=36
- Detergente (Productos de Limpieza) — Cant=1, Precio=55 → Subtotal=55
- Shampoo (Higiene Personal) — Cant=1, Precio=65 → Subtotal=65
- Bolsas (Otros Mandado) — Cant=1, Precio=15 → Subtotal=15

Todos estos ejemplos están cargados solo en la **Semana 1** (columnas C-E); las Semanas 2-5 (F-Q) están en cero/vacías para todos los productos, sirviendo como plantilla replicada.

Fila 39: "TOTAL MANDADO" (total general del mes, sumando las 8 categorías). Valor actual: 424 (todo proviene de Semana 1; semanas 2-5 = 0).

Filas 42-46: Leyenda de colores (ver sección de convenciones arriba).

**Fórmulas encontradas y su lógica:**

1. **Subtotal por producto (por semana):** `Subtotal = Cantidad × Precio`
   Ej. `E8 = C8*D8` (Semana 1, fila producto "Tomate"); el mismo patrón se repite en cada bloque semanal (`H8=F8*G8`, `K8=I8*J8`, `N8=L8*M8`, `Q8=O8*P8`) y para cada una de las 3 filas de producto de cada categoría.

2. **Total Mes por producto (columna R):** `Total Mes = Subtotal_Sem1 + Subtotal_Sem2 + Subtotal_Sem3 + Subtotal_Sem4 + Subtotal_Sem5`
   Ej. `R8 = E8+H8+K8+N8+Q8`

3. **Subtotal por categoría (por semana):** `Subtotal_categoría = SUMA(3 filas de producto de esa categoría)`
   Ej. `E7 = SUMA(E8:E10)` (Frutas y Verduras, Semana 1)

4. **Total Mes por categoría (columna R, fila de categoría):** suma de las 5 semanas de esa categoría.
   Ej. `R7 = E7+H7+K7+N7+Q7`

5. **TOTAL MANDADO por semana (fila 39):** suma de las 8 filas-categoría de esa semana.
   Ej. `E39 = E7+E11+E15+E19+E23+E27+E31+E35`

6. **TOTAL MANDADO Total Mes (R39):** suma de las 5 semanas del total mandado, o equivalentemente suma de R7,R11,...
   `R39 = E39+H39+K39+N39+Q39`

**Regla de negocio implícita:** cada categoría tiene un límite fijo de **3 productos por semana** (estructura rígida de 3 filas por categoría, no expansible sin editar fórmulas). El total del mandado se calcula por semana y se acumula en un total mensual; NO hay una columna de "categoría de producto libre" — las 8 categorías son fijas y predefinidas en el diseño original.

**Relación con otras hojas:** Los totales semanales de mandado (E39, H39, K39, N39, Q39) alimentan directamente la hoja `Semanal` (ver fórmulas de la hoja Semanal, fila "Mandado"). Esta es la única hoja de la que se "importan" datos automáticamente hacia otra hoja del libro.

---

## Hoja 2: `Semanal`

**Propósito:** Control de ingresos y gastos semana por semana (hasta 5 semanas por "mes" o periodo), con balance.

**Rango usado:** B2:H34 (33 filas × 7 columnas)

**Encabezados (fila 5):** B5="Concepto", C5="Semana 1", D5="Semana 2", E5="Semana 3", F5="Semana 4", G5="Semana 5", H5="Total Mes"

**Texto de ayuda (B3):** "Llena las celdas amarillas (semana/fecha, ingresos y gastos). El Mandado se trae solo de la hoja Mandado."

**Filas de identificación de semana (sin datos capturados, vacías/editables):**
- B6: "No. de Semana (1-52)" — fila de encabezado para que el usuario anote el número de semana calendario (1 a 52) por cada una de las 5 columnas; actualmente vacía.
- B7: "Fecha (Inicio - Fin)" — rango de fechas de cada semana; formato de celda `@` (texto), actualmente vacía. Confirma que la fecha se captura como texto libre, no como fecha real de Excel.

**Bloque "Ingresos" (fila 9 = encabezado de sección):**
- Ingreso 1 (ej. Sueldo) — fila 10
- Ingreso 2 (ej. Extra) — fila 11
- Ingreso 3 (ej. Otro) — fila 12
- Total Ingreso — fila 13 (fórmula)

**Bloque "Gastos" (fila 15 = encabezado de sección), 11 conceptos fijos de gasto:**
1. Coppel (fila 16)
2. Diezmo (fila 17)
3. Renta (fila 18)
4. Fernando (fila 19)
5. Internet (fila 20)
6. Mandado (fila 21) — **única fila vinculada por fórmula a otra hoja**
7. Croquetas (fila 22)
8. Curso (fila 23)
9. Mochila (fila 24)
10. DiDi (fila 25)
11. Otros (fila 26)
- Total Gastos — fila 27 (fórmula)
- Balance (Ingreso - Gastos) — fila 28 (fórmula)

Filas 31-34: Leyenda de colores.

**Fórmulas encontradas y su lógica:**

1. **Total Ingreso (fila 13, por columna de semana):** `= SUMA(Ingreso1:Ingreso3)` de esa semana.
   Ej. `C13 = SUMA(C10:C12)`
2. **Total Mes de cada línea de ingreso (columna H):** `= SUMA(Semana1:Semana5)` de esa fila.
   Ej. `H10 = SUMA(C10:G10)`, `H13 = SUMA(C13:G13)`
3. **Mandado (fila 21) — referencia cruzada a la hoja Mandado (NO es suma local, es un enlace directo):**
   - `C21 = Mandado!E39` (Total Mandado Semana 1)
   - `D21 = Mandado!H39` (Total Mandado Semana 2)
   - `E21 = Mandado!K39` (Total Mandado Semana 3)
   - `F21 = Mandado!N39` (Total Mandado Semana 4)
   - `G21 = Mandado!Q39` (Total Mandado Semana 5)
   - `H21 = Mandado!R39` (Total Mandado del mes completo)
4. **Total Gastos por semana (fila 27):** `= SUMA(Coppel:Otros)` de esa columna, es decir suma de las 11 filas de gasto (incluyendo la fila Mandado ya resuelta por el enlace anterior).
   Ej. `C27 = SUMA(C16:C26)`
5. **Total Gastos Total Mes (H27):** `= SUMA(C27:G27)`
6. **Balance (fila 28):** `Balance = Total Ingreso − Total Gastos`, por columna.
   Ej. `C28 = C13 - C27`; `H28 = H13 - H27`

**Relación con otras hojas:**
- **Entrada desde `Mandado`:** la fila "Mandado" (16-21) de esta hoja NO se captura a mano — se calcula 100% desde los totales semanales de la hoja Mandado (`Mandado!E39/H39/K39/N39/Q39/R39`). Es la única integración automática confirmada en todo el libro entre hojas de nivel semanal/mandado.
- No hay ninguna fórmula en `Semanal` que alimente a `Mensual` — la relación Semanal→Mensual **no existe como fórmula**; los datos de gasto mensual se capturan de forma independiente y manual en la hoja `Mensual` (ver más abajo). Esto es una inconsistencia/vacío funcional a resolver en la migración.

**Datos actuales:** Solo la Semana 1 tiene datos (Mandado=424 heredado de la hoja Mandado); todo lo demás está en cero. Balance actual Semana 1 = -424 (sin ingresos capturados).

---

## Hoja 3: `Mensual`

**Propósito:** Control de ingresos y gastos por mes calendario (Ene-Dic) con acumulado anual.

**Rango usado:** B2:O30 (29 filas × 14 columnas)

**Encabezados (fila 5):** B5="Concepto", C5..N5 = "Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic" (12 meses), O5="Total Anual"

**Texto de ayuda (B3):** "Llena las celdas amarillas (ingresos y gastos por mes). Totales, balance y total anual se calculan solos."

**Bloque "Ingresos" (fila 6 = encabezado de sección):**
- Ingreso 1 (ej. Sueldo) — fila 7
- Ingreso 2 (ej. Extra) — fila 8
- Ingreso 3 (ej. Otro) — fila 9
- Total Ingreso — fila 10 (fórmula)

**Bloque "Gastos" (fila 12 = encabezado de sección), los mismos 11 conceptos fijos que en `Semanal`:**
1. Coppel (13)
2. Diezmo (14)
3. Renta (15)
4. Fernando (16)
5. Internet (17)
6. Mandado (18) — **sin fórmula de enlace, es una fila de captura manual**
7. Croquetas (19)
8. Curso (20)
9. Mochila (21)
10. DiDi (22)
11. Otros (23)
- Total Gastos — fila 24 (fórmula)
- Balance (Ingreso - Gastos) — fila 25 (fórmula)

Filas 28-30: Leyenda de colores.

**Fórmulas encontradas y su lógica:**

1. **Total Anual de cada línea (columna O), tanto para ingresos como para gastos:** `= SUMA(Ene:Dic)` de esa fila.
   Ej. `O7 = SUMA(C7:N7)` (Ingreso 1); `O18 = SUMA(C18:N18)` (Mandado)
2. **Total Ingreso por mes (fila 10):** `= SUMA(Ingreso1:Ingreso3)` de esa columna.
   Ej. `C10 = SUMA(C7:C9)`
3. **Total Ingreso Total Anual (O10):** `= SUMA(C10:N10)`
4. **Total Gastos por mes (fila 24):** `= SUMA(Coppel:Otros)` de esa columna (11 conceptos).
   Ej. `C24 = SUMA(C13:C23)`
5. **Total Gastos Total Anual (O24):** `= SUMA(C24:N24)`
6. **Balance por mes (fila 25):** `Balance = Total Ingreso mes − Total Gastos mes`.
   Ej. `C25 = C10-C24`; **Nota:** `O25 = O10-O24` (Balance Total Anual calculado como diferencia de totales anuales, NO como suma de balances mensuales — aritméticamente equivalente pero confirma que no hay doble cálculo).

**Relación con otras hojas:**
- **Ninguna fórmula entrante** desde `Mandado` ni desde `Semanal`. La fila "Mandado" de esta hoja (fila 18) contiene solo valores estáticos en cero — es 100% captura manual independiente del desglose semanal de mandado. Esto significa que en el Excel original, el usuario tendría que sumar manualmente sus 4-5 mandados semanales y anotar el total en la hoja Mensual; **no hay automatización entre Semanal/Mandado y Mensual**.
- **Salida hacia `Resumen`:** todas las 11 filas de gasto de columna O (Total Anual) alimentan directamente la hoja `Resumen` (ver abajo).

**Datos actuales:** Todo en cero (sin datos capturados en esta hoja; solo estructura y fórmulas).

---

## Hoja 4: `Resumen`

**Propósito:** Resumen anual acumulado de gastos por categoría (una fila por concepto de gasto), tomado íntegramente de la hoja Mensual.

**Rango usado:** B2:D17 (16 filas × 3 columnas)

**Encabezados (fila 5):** B5="Categoría", C5="Total Anual"

**Texto de ayuda (B3):** "Se llena solo, tomando los totales anuales de la hoja Mensual."

**Filas (los mismos 11 conceptos de gasto de `Semanal`/`Mensual`, en el mismo orden, más un total general):**
1. Coppel (fila 6) → `=Mensual!O13`
2. Diezmo (fila 7) → `=Mensual!O14`
3. Renta (fila 8) → `=Mensual!O15`
4. Fernando (fila 9) → `=Mensual!O16`
5. Internet (fila 10) → `=Mensual!O17`
6. Mandado (fila 11) → `=Mensual!O18`
7. Croquetas (fila 12) → `=Mensual!O19`
8. Curso (fila 13) → `=Mensual!O20`
9. Mochila (fila 14) → `=Mensual!O21`
10. DiDi (fila 15) → `=Mensual!O22`
11. Otros (fila 16) → `=Mensual!O23`
12. Total General (fila 17) → `=SUMA(C6:C16)`

**Fórmulas encontradas y su lógica:** Esta hoja es 100% de solo lectura/derivada. Cada fila de categoría es un enlace de celda directo (`=Mensual!O<fila>`) a la columna "Total Anual" de la hoja Mensual (no hay suma propia por categoría, es una referencia 1:1). El Total General suma las 11 categorías.

**Relación con otras hojas:** Depende exclusivamente de `Mensual` (columna O, Total Anual). No tiene ninguna relación directa con `Semanal` ni con `Mandado` — solo indirecta, a través de Mensual (y en el caso de "Mandado", esa relación indirecta está rota porque Mensual!O18 se captura a mano, no se alimenta de Mandado/Semanal).

**Datos actuales:** Todo en cero (heredado de Mensual, que también está en cero).

---

## Mapa de relaciones entre hojas (resumen visual)

```
Mandado (detalle de productos por categoría, 5 semanas)
   │  Totales por semana: Mandado!E39, H39, K39, N39, Q39, R39
   ▼  (única integración automática confirmada)
Semanal!C21:H21 ("Mandado")  ──────────────►  Semanal!C27:H27 (Total Gastos)
   │
   X  (SIN fórmula de enlace — hueco funcional)
   ▼
Mensual!C18:N18 ("Mandado")  se captura A MANO, independiente de Semanal/Mandado
   │  Mensual!O13:O23 (Total Anual por categoría, 11 filas)
   ▼  (única integración automática hacia Resumen)
Resumen!C6:C16  = Mensual!O13..O23   (enlaces 1:1 por categoría)
   ▼
Resumen!C17 = SUMA(C6:C16)  (Total General anual)
```

## Reglas de negocio implícitas (consolidado)

1. **Cascada de sumas dentro de Mandado:** Producto (Cant×Precio) → Categoría (suma de 3 productos) → Total semana (suma de 8 categorías) → Total mes (suma de 5 semanas). Estructura rígida: exactamente 8 categorías fijas y exactamente 3 slots de producto por categoría por semana (no crecen dinámicamente en el Excel original).
2. **El "mandado" fluye automáticamente de Mandado a Semanal, pero se detiene ahí.** El total mandado semanal viaja por fórmula a `Semanal`, pero de `Semanal` a `Mensual` NO hay ningún enlace: el usuario debe re-capturar manualmente cada concepto de gasto (incluyendo Mandado) en la hoja Mensual. Esto es la brecha de automatización más importante a resolver al migrar a una app web (idealmente los gastos semanales deberían acumularse automáticamente al mes correspondiente).
3. **11 conceptos de gasto fijos y compartidos entre `Semanal` y `Mensual`:** Coppel, Diezmo, Renta, Fernando, Internet, Mandado, Croquetas, Curso, Mochila, DiDi, Otros — mismo orden exacto en ambas hojas, lo que sugiere que son categorías de gasto "de catálogo" pensadas para permanecer fijas mes a mes (algunas parecen deudas/compromisos fijos: Coppel=tienda de crédito/empeño, Diezmo=aportación religiosa, Renta=vivienda, Fernando=persona/pensión o préstamo, Internet=servicio; otras son gasto variable: Mandado, Croquetas=comida de mascota, Curso, Mochila, DiDi=transporte, Otros=catch-all).
4. **3 fuentes de ingreso genéricas, sin categoría fija:** "Ingreso 1 (ej. Sueldo)", "Ingreso 2 (ej. Extra)", "Ingreso 3 (ej. Otro)" — son placeholders editables por el usuario (el label sugerido es solo un ejemplo, no una categoría fija como en Gastos).
5. **Balance = Ingresos − Gastos**, calculado de manera idéntica y consistente tanto en `Semanal` (por semana y total mes) como en `Mensual` (por mes y total anual).
6. **Resumen es una vista derivada de solo lectura**, sin captura propia; sirve como reporte final de "gasto acumulado anual por categoría".
7. **La fecha de la semana se captura como texto libre** (formato de celda `@`, no fecha real de Excel) en `Semanal!C7:G7` — no hay validación de fecha ni cálculo automático de rango de fechas a partir del número de semana.
8. **Convención de color como contrato de UI:** amarillo=input manual, gris cursiva=ejemplo editable, verde/azul=calculado (solo lectura), gris=no aplica. Este contrato debe traducirse a estados de campo (editable/disabled/computed) en la app web.

## Datos atípicos / inconsistencias notables

- **Brecha Semanal → Mensual:** como se documentó arriba, no existe ninguna fórmula que sume los gastos semanales (ni el mandado) hacia el mes correspondiente en `Mensual`. Es la inconsistencia más relevante para el diseño de la app web: hay que decidir si la nueva app automatiza esta agregación (recomendado) o mantiene la captura manual duplicada del Excel original.
- **Estructura de "5 semanas por mes" en `Mandado`/`Semanal` vs. "12 meses" en `Mensual`:** un mes tiene entre 4 y 5 semanas calendario reales, pero el diseño fija siempre 5 columnas de semana por "periodo" en Mandado/Semanal sin relación explícita con el mes calendario de Mensual (el número de semana y las fechas se anotan a mano en `Semanal!C6:G7`, sin vínculo a los 12 meses de la hoja Mensual).
- **Solo la Semana 1 de Mandado tiene datos de ejemplo**; Semanas 2-5 y todas las categorías de Semanal/Mensual/Resumen están en cero — el archivo es esencialmente una plantilla/prototipo con datos de muestra mínimos, no un histórico real de gastos.
- **Cada categoría de Mandado tiene capacidad fija de solo 3 productos** por semana (filas de producto hard-codeadas en la fórmula de suma de categoría, ej. `=SUMA(E8:E10)`); agregar un 4° producto en el Excel original requeriría insertar una fila y ajustar manualmente el rango de la fórmula — en la app web esto debería ser una lista dinámica sin límite fijo.
- **No hay validación de datos (data validation) ni rangos con nombre** detectados en el libro; toda la lógica vive en fórmulas de celda simples (SUMA y referencias directas), sin macros VBA.
- **Fórmulas usan `:` con referencia relativa simple** (no hay fórmulas de array, BUSCARV/XLOOKUP, tablas de Excel, ni Power Query) — el modelo de datos es enteramente plano y manual, lo que facilita bastante la migración a un modelo relacional (categorías, productos, transacciones, periodos) en la app web.
