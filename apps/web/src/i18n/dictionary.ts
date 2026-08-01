/**
 * Forma canónica del diccionario de traducciones del panel.
 *
 * Cada uno de los cinco ficheros de idioma (`es-ES.ts`, `en-GB.ts`, `de-DE.ts`,
 * `pt-BR.ts`, `gl-ES.ts`) declara su `dictionary` tipado como `Dictionary`:
 * TypeScript rechaza tanto una clave que falte como una que sobre en cuanto
 * se compila (`npm run typecheck`), antes incluso de llegar a
 * `coverage.spec.ts` (Paso 5b), que repite la misma comprobación en tiempo de
 * ejecución sobre los ficheros reales — dos capas, porque la primera se
 * puede saltar con un `as` mal puesto y la segunda no.
 *
 * Los valores son patrones ICU (`intl-messageformat`), igual que el catálogo
 * de errores del backend: una cadena sin marcadores es un patrón ICU válido
 * sin más.
 */
export interface Dictionary {
  common: {
    /** Nombre del producto. Igual en los cinco idiomas: una marca no se traduce. */
    appName: string;
    loading: string;
    retry: string;
    emptyTitle: string;
    unexpectedError: string;
    languageLabel: string;
    /**
     * Etiquetas accesibles de `ToastProvider` (`ui/Toast.tsx`, Tarea 4),
     * montado una sola vez en `main.tsx`: la región donde aparecen los
     * avisos y el botón de cerrar cada uno. Añadidas por la Tarea 7
     * (Alumnado), la primera pantalla que usa `useToast()`.
     */
    toastRegionLabel: string;
    toastCloseLabel: string;
  };
  /**
   * Traducciones propias del panel para los `code` de error de la API que
   * conoce. Las claves son literalmente los `code` del catálogo del backend
   * (`apps/api/.../i18n/messages.ts`) — salvo `network_error`, que genera el
   * propio cliente HTTP del panel cuando `fetch` falla antes de llegar a la
   * API. `coverage.spec.ts` comprueba que ningún otro código diverge entre
   * los dos catálogos.
   */
  errors: {
    missing_tenant: string;
    insufficient_role: string;
    not_found: string;
    validation_failed: string;
    concurrency_conflict: string;
    authentication_required: string;
    email_not_verified: string;
    internal_error: string;
    network_error: string;
    /**
     * Añadidas por la Tarea 9 (Calendario): el brief exige que estos dos
     * errores de dominio se muestren junto al campo culpable (el
     * profesor), no como un aviso genérico — necesitan su propio texto en
     * el catálogo del panel, a diferencia del resto de errores de
     * `scheduling` (`session_already_closed`, `invalid_time_slot`...), que
     * siguen cayendo al `title` ya traducido de la API.
     */
    teacher_overlap: string;
    teacher_not_available: string;
    /**
     * Añadidas por la Tarea 10 (Facturación): quien abre una devolución
     * necesita ver, junto al importe, por qué la API la rechaza —no puede
     * devolver más de lo cobrado, ni tocar una factura en un estado que no lo
     * admite (una en borrador, por ejemplo).
     */
    refund_exceeds_payment: string;
    invalid_invoice_state: string;
    /**
     * Añadidos por la Tarea 11 (Portal del alumno y aula del profesor): el
     * texto del catálogo de la API se traduce con la prioridad persona →
     * escuela → cabecera (`resolveLocale`), que en una escuela con locale
     * propio distinto del navegador de quien mira (p. ej. Nordwind, de-DE)
     * puede no coincidir con el idioma del resto del panel — cayendo al
     * `title` de la API, un tutor con el panel en español vería este aviso de
     * seguridad en alemán. Con entrada propia aquí, se pinta siempre en el
     * idioma de QUIEN MIRA, como el resto de la pantalla. Mismo texto que la
     * API, solo repetido en el catálogo del cliente.
     */
    portal_access_denied: string;
    room_not_ready: string;
    not_enrolled_in_session: string;
  };
  /**
   * Sesión, acceso y cambio de escuela (Tarea 3). No son `code` del catálogo
   * de errores de la API (por eso viven fuera de `errors.*`, que
   * `coverage.spec.ts` contrasta contra el catálogo del backend): son texto
   * propio de la pantalla de acceso y del selector de escuela.
   */
  auth: {
    loginTitle: string;
    loginSubtitle: string;
    emailLabel: string;
    passwordLabel: string;
    submit: string;
    submitting: string;
    orDivider: string;
    continueWithGoogle: string;
    emailRequired: string;
    emailInvalid: string;
    passwordRequired: string;
    invalidCredentials: string;
    genericError: string;
    checkingSession: string;
    schoolPickerTitle: string;
    schoolPickerDescription: string;
    noSchools: string;
    chooseSchool: string;
    signOut: string;
    switchSchool: string;
  };
  /**
   * Panel de dirección (Tarea 6). Las tres secciones, de arriba abajo, en el
   * mismo orden en el que se pintan: indicadores, alumnado en riesgo,
   * ocupación del profesorado.
   */
  dashboard: {
    title: string;
    indicators: {
      activeStudents: string;
      averageAttendance: string;
      /** Ventana de la métrica (`ATTENDANCE_WINDOW_DAYS` en la API): 4 semanas. */
      averageAttendanceHint: string;
      nps: string;
      /** El `nps` de la API es siempre `null` hasta que exista `feedback` (ola 3). */
      npsPending: string;
      invoicedThisMonth: string;
      invoicedThisMonthHint: string;
    };
    atRisk: {
      title: string;
      columnStudent: string;
      columnAttendance: string;
      columnLastEvaluation: string;
      columnStatus: string;
      /** `attendanceRate` es `null`: sin clases en la ventana de asistencia. */
      attendanceUnknown: string;
      /** `weeksSinceLastEvaluation` es `null`: nunca se le ha valorado. */
      lastEvaluationNever: string;
      lastEvaluationWeeks: string;
      reasonLowAttendance: string;
      reasonNoRecentEvaluation: string;
      emptyTitle: string;
    };
    occupancy: {
      title: string;
      signalHealthy: string;
      signalOverloaded: string;
      signalUnderused: string;
      detail: string;
      emptyTitle: string;
    };
  };
  /**
   * Alumnado (Tarea 7 del panel web): listado, alta, ficha, importación por
   * CSV y valoraciones. `status`, `guardianRelationship` y las claves de
   * cada pestaña de la ficha viven en el nivel de `students`, no repetidas
   * por pantalla, porque las mismas etiquetas (p. ej. el estado "activo")
   * aparecen tanto en el listado como en la ficha.
   */
  students: {
    title: string;
    newStudent: string;
    importCsv: string;
    backToList: string;
    levelNone: string;
    status: {
      active: string;
      paused: string;
      left: string;
    };
    guardianRelationship: {
      mother: string;
      father: string;
      legal_guardian: string;
      other: string;
    };
    list: {
      searchLabel: string;
      levelLabel: string;
      levelAll: string;
      statusLabel: string;
      statusAll: string;
      columnName: string;
      columnEmail: string;
      columnLevel: string;
      columnStatus: string;
      columnGuardian: string;
      columnJoinedAt: string;
      guardianRequired: string;
      caption: string;
      emptyTitle: string;
      emptyDescription: string;
      noResultsTitle: string;
      noResultsDescription: string;
      errorTitle: string;
      pageIndicator: string;
      previousPage: string;
      nextPage: string;
    };
    create: {
      title: string;
      nameLabel: string;
      nameRequired: string;
      emailLabel: string;
      emailRequired: string;
      emailInvalid: string;
      dateOfBirthLabel: string;
      dateOfBirthRequired: string;
      nativeLanguageLabel: string;
      nativeLanguageRequired: string;
      targetLanguageLabel: string;
      targetLanguageRequired: string;
      localeLabel: string;
      localeNone: string;
      levelLabel: string;
      guardianTitle: string;
      guardianHint: string;
      guardianNameLabel: string;
      guardianNameRequired: string;
      guardianEmailLabel: string;
      guardianEmailRequired: string;
      guardianEmailInvalid: string;
      guardianRelationshipLabel: string;
      guardianRelationshipRequired: string;
      submit: string;
      submitting: string;
      genericError: string;
      success: string;
    };
    detail: {
      notFoundTitle: string;
      loadingTitle: string;
      emailNotEditableHint: string;
      nameLabel: string;
      emailLabel: string;
      joinedAtLabel: string;
      nativeLanguageLabel: string;
      targetLanguageLabel: string;
      goalsLabel: string;
      targetLevelLabel: string;
      statusLabel: string;
      pausedUntilLabel: string;
      leftReasonLabel: string;
      guardiansTitle: string;
      noGuardians: string;
      tabData: string;
      tabAttendance: string;
      tabConsents: string;
      tabInvoices: string;
      tabEvaluations: string;
      tabProgress: string;
      editTitle: string;
      editSubmit: string;
      editSubmitting: string;
      editSuccess: string;
      editError: string;
      leaveAction: string;
      leaveDialogTitle: string;
      leaveDialogDescription: string;
      leaveReasonLabel: string;
      leaveReasonRequired: string;
      leaveConfirm: string;
      leaveCancel: string;
      leaveSuccess: string;
      leaveError: string;
      closeDialog: string;
    };
    attendance: {
      caption: string;
      columnDate: string;
      columnGroup: string;
      columnStatus: string;
      columnMinutes: string;
      emptyTitle: string;
      errorTitle: string;
      status: {
        present: string;
        late: string;
        absent: string;
        excused: string;
      };
    };
    consents: {
      caption: string;
      columnKind: string;
      columnStatus: string;
      columnDetail: string;
      notRecorded: string;
      granted: string;
      withdrawn: string;
      grantedOn: string;
      withdrawnOn: string;
      errorTitle: string;
      kind: {
        data_processing: string;
        recording: string;
        transcription: string;
        ai_processing: string;
        marketing: string;
        image_rights: string;
      };
    };
    invoices: {
      caption: string;
      columnNumber: string;
      columnDirection: string;
      columnStatus: string;
      columnTotal: string;
      columnIssuedOn: string;
      columnDueOn: string;
      columnPaidAt: string;
      emptyTitle: string;
      errorTitle: string;
      direction: {
        school_to_student: string;
        platform_to_school: string;
      };
      status: {
        draft: string;
        open: string;
        paid: string;
        past_due: string;
        void: string;
        uncollectible: string;
      };
    };
    evaluations: {
      caption: string;
      errorTitle: string;
      emptyTitle: string;
      overdueTitle: string;
      overdueNever: string;
      overdueWeeks: string;
      periodDisplay: string;
      ratingLabel: string;
      ratingValue: string;
      strengthsLabel: string;
      improvementsLabel: string;
      nextStepsLabel: string;
      byTeacher: string;
      formTitle: string;
      teacherIdLabel: string;
      teacherIdHint: string;
      teacherIdRequired: string;
      teacherIdInvalid: string;
      periodStartLabel: string;
      periodStartRequired: string;
      periodEndLabel: string;
      periodEndRequired: string;
      levelAtEvaluationLabel: string;
      minLengthError: string;
      submit: string;
      submitting: string;
      success: string;
      genericError: string;
    };
    import: {
      title: string;
      step1Title: string;
      step1Description: string;
      fileLabel: string;
      analyze: string;
      analyzing: string;
      chooseFileFirst: string;
      fileReadError: string;
      step2Title: string;
      summary: string;
      columnRow: string;
      columnStatus: string;
      columnSummary: string;
      columnErrors: string;
      rowValid: string;
      /**
       * `POST /students/import/commit` (a diferencia de `preview`) sí
       * escribe cada fila válida: distingue si dio de alta a alguien nuevo
       * o puso al día una ficha que ya existía (`ImportCommitRowResult`,
       * API), en vez de repetir el genérico `rowValid` de la previsualización.
       */
      rowCreated: string;
      rowUpdated: string;
      rowInvalid: string;
      confirm: string;
      confirming: string;
      back: string;
      commitTitle: string;
      commitSummary: string;
      errorTitle: string;
      noValidRows: string;
    };
  };
  /**
   * Progreso del alumno (Tarea 16 de la ola 2): un único bloque de claves
   * para las DOS pantallas que lo enseñan —la pestaña «Progreso» de la
   * ficha del alumno (`students.detail.tabProgress`, dirección y
   * profesorado) y `/mi/progreso` en el portal (`portal.progress.title`, el
   * propio alumno o su tutor legal)—: mismo componente (`ProgressPanel`),
   * mismo contenido, sin duplicar 20 claves en dos sitios por dos títulos de
   * pantalla distintos.
   */
  progress: {
    errorTitle: string;
    completionTitle: string;
    /** Sin ningún ejercicio publicado a sus grupos todavía: `null` en la API, no un 0 % engañoso. */
    completionEmpty: string;
    completionValue: string;
    averageTitle: string;
    /** Sin ningún intento validado por el profesor todavía: solo lo firmado cuenta (`OLA-2.md`). */
    averageEmpty: string;
    averageValue: string;
    skillTitle: string;
    skillEmpty: string;
    skillColumnSkill: string;
    skillColumnAverage: string;
    skillColumnCount: string;
    /** Espejo de `language_skill` (`packages/db/src/schema/enums.ts`). */
    skill: {
      listening: string;
      reading: string;
      speaking: string;
      writing: string;
      vocabulary: string;
      grammar: string;
      phonetics: string;
    };
    trendTitle: string;
    trendEmpty: string;
    trendColumnWeek: string;
    trendColumnAverage: string;
    trendColumnMoving: string;
    streakTitle: string;
    streakEmpty: string;
    streakValue: string;
  };
  /**
   * Profesorado (Tarea 8 del panel web): listado y ficha, con tarifa y
   * disponibilidad semanal editable en cuadrícula. `tier` y `status` viven en
   * el nivel de `teachers`, no repetidos por pantalla — igual criterio que
   * `students.status`.
   */
  teachers: {
    title: string;
    /** Botón que abre `HireTeacherDialog` (Tarea 13, hallazgo cerrado: T8 no dejó alta de profesorado en el panel). */
    newTeacher: string;
    tier: {
      community: string;
      professional: string;
      specialist: string;
    };
    status: {
      active: string;
      on_leave: string;
      left: string;
    };
    list: {
      searchLabel: string;
      tierLabel: string;
      tierAll: string;
      statusLabel: string;
      statusAll: string;
      columnName: string;
      columnEmail: string;
      columnTier: string;
      columnRate: string;
      columnHours: string;
      columnStatus: string;
      columnLanguages: string;
      caption: string;
      emptyTitle: string;
      emptyDescription: string;
      noResultsTitle: string;
      noResultsDescription: string;
      errorTitle: string;
    };
    detail: {
      notFoundTitle: string;
      tabData: string;
      tabAvailability: string;
      profileTitle: string;
      tierLabel: string;
      hourlyRateLabel: string;
      hourlyRateHint: string;
      hiredAtLabel: string;
      contractedHoursLabel: string;
      statusLabel: string;
      languagesLabel: string;
      certificationsLabel: string;
      isNativeSpeakerLabel: string;
      isNativeSpeakerYes: string;
      isNativeSpeakerNo: string;
      bioLabel: string;
      leftReasonLabel: string;
      editSubmit: string;
      editSubmitting: string;
      editSuccess: string;
      editError: string;
      releaseAction: string;
      releaseDialogTitle: string;
      releaseDialogDescription: string;
      releaseReasonLabel: string;
      releaseReasonRequired: string;
      releaseConfirm: string;
      releaseCancel: string;
      releaseSuccess: string;
      releaseError: string;
      closeDialog: string;
    };
    /** Alta de profesor (Tarea 13, hallazgo: `POST /teachers` ya existía sin ninguna pantalla que lo llamara). */
    create: {
      title: string;
      nameLabel: string;
      nameRequired: string;
      emailLabel: string;
      emailRequired: string;
      emailInvalid: string;
      tierLabel: string;
      hourlyRateLabel: string;
      hourlyRateHint: string;
      hourlyRateRequired: string;
      contractedHoursLabel: string;
      contractedHoursHint: string;
      contractedHoursRequired: string;
      hiredAtLabel: string;
      hiredAtRequired: string;
      submit: string;
      submitting: string;
      success: string;
      genericError: string;
      close: string;
    };
    availability: {
      caption: string;
      hint: string;
      mon: string;
      tue: string;
      wed: string;
      thu: string;
      fri: string;
      sat: string;
      sun: string;
      cellLabel: string;
      cellStateActive: string;
      cellStateInactive: string;
      save: string;
      saving: string;
      success: string;
      genericError: string;
    };
  };
  /**
   * Cursos y grupos (Tarea 8 del panel web): catálogo con sus grupos
   * anidados, alta de curso con traducciones por idioma soportado, alta de
   * grupo y ficha de un grupo con matriculación.
   */
  courses: {
    title: string;
    newCourse: string;
    newGroup: string;
    close: string;
    modality: {
      private: string;
      group: string;
      intensive: string;
      exam_prep: string;
      business: string;
      conversation: string;
    };
    groupStatus: {
      planned: string;
      running: string;
      finished: string;
      canceled: string;
    };
    list: {
      errorTitle: string;
      emptyTitle: string;
      emptyDescription: string;
      columnLanguage: string;
      columnLevel: string;
      columnModality: string;
      columnSessions: string;
      columnPrice: string;
      columnActive: string;
      activeYes: string;
      activeNo: string;
      columnGroupName: string;
      columnGroupTeacher: string;
      columnGroupCapacity: string;
      columnGroupStatus: string;
      columnGroupDates: string;
      teacherUnassigned: string;
      datesRange: string;
      datesOpenEnded: string;
      groupsCaption: string;
      groupsEmpty: string;
    };
    create: {
      title: string;
      codeLabel: string;
      codeRequired: string;
      languageLabel: string;
      languageRequired: string;
      levelLabel: string;
      modalityLabel: string;
      totalSessionsLabel: string;
      totalSessionsHint: string;
      sessionMinutesLabel: string;
      maxStudentsLabel: string;
      maxStudentsHint: string;
      priceLabel: string;
      priceHint: string;
      priceRequired: string;
      currencyLabel: string;
      translationsTitle: string;
      translationsHint: string;
      translationNameLabel: string;
      translationNameRequired: string;
      translationDescriptionLabel: string;
      submit: string;
      submitting: string;
      genericError: string;
      success: string;
    };
    groupCreate: {
      title: string;
      nameLabel: string;
      nameRequired: string;
      teacherLabel: string;
      teacherUnassignedOption: string;
      startsOnLabel: string;
      startsOnRequired: string;
      endsOnLabel: string;
      submit: string;
      submitting: string;
      genericError: string;
      success: string;
    };
    groupDetail: {
      notFoundTitle: string;
      errorTitle: string;
      teacherLabel: string;
      teacherUnassigned: string;
      statusLabel: string;
      startsOnLabel: string;
      endsOnLabel: string;
      endsOnOpen: string;
      capacityLabel: string;
      capacityValue: string;
      capacityFull: string;
      rosterTitle: string;
      rosterCaption: string;
      columnStudentName: string;
      rosterEmptyTitle: string;
      rosterErrorTitle: string;
      enrolTitle: string;
      studentLabel: string;
      studentPlaceholder: string;
      studentRequired: string;
      studentsEmptyHint: string;
      agreedPriceLabel: string;
      agreedPriceHint: string;
      enrolSubmit: string;
      enrolSubmitting: string;
      enrolSuccess: string;
      enrolGenericError: string;
    };
  };
  /**
   * Calendario (Tarea 9 del panel web): vista semanal, alta, replanificación,
   * cancelación con devolución y asistencia. Las fechas que pinta esta
   * pantalla van siempre en la zona horaria de la escuela
   * (`useSchoolTimezone`, `formatDate`), nunca la del navegador.
   */
  calendar: {
    title: string;
    previousWeek: string;
    nextWeek: string;
    today: string;
    weekRangeLabel: string;
    newSession: string;
    emptyTitle: string;
    emptyDescription: string;
    errorTitle: string;
    close: string;

    groupLabel: string;
    groupPlaceholder: string;
    groupEmptyHint: string;
    teacherLabel: string;
    teacherUnassignedOption: string;
    roomProviderLabel: string;
    roomProviderLivekit: string;
    roomProviderZoom: string;
    roomProviderGoogleMeet: string;
    roomProviderMsTeams: string;
    roomProviderInPerson: string;
    roomUrlLabel: string;
    roomExternalIdLabel: string;
    startsAtLabel: string;
    durationLabel: string;
    topicLabel: string;
    scheduleDialogTitle: string;
    scheduleSubmit: string;
    scheduleSubmitting: string;
    scheduleSuccessToast: string;

    sessionMenuTitle: string;
    sessionMenuGroupLabel: string;
    sessionMenuTeacherLabel: string;
    sessionMenuTeacherUnassigned: string;
    sessionMenuTimeLabel: string;
    sessionMenuStatusLabel: string;
    sessionMenuRoomLabel: string;
    actionReschedule: string;
    actionCancel: string;
    actionAttendance: string;
    /**
     * Añadido por la Tarea 11 (Portal del alumno y aula del profesor): entrar
     * al aula se ofrece siempre, sin mirar el estado de la clase — igual que
     * las otras tres acciones de este menú, es la API quien decide si de
     * verdad se puede (`room_not_ready`, `not_enrolled_in_session`...).
     */
    actionJoinClassroom: string;

    cancelDialogTitle: string;
    partyLabel: string;
    partySchool: string;
    partyStudent: string;
    reasonLabel: string;
    refundPreviewYes: string;
    refundPreviewNo: string;
    noticeHoursInfo: string;
    confirmCancel: string;
    confirmCancelSubmitting: string;
    cancelSuccessToastRefund: string;
    cancelSuccessToastNoRefund: string;

    rescheduleDialogTitle: string;
    rescheduleHint: string;
    newStartsAtLabel: string;
    confirmReschedule: string;
    confirmRescheduleSubmitting: string;
    rescheduleSuccessToast: string;

    attendanceDialogTitle: string;
    attendanceInstructions: string;
    attendanceEmptyRoster: string;
    confirmAttendance: string;
    confirmAttendanceSubmitting: string;
    attendanceSuccessToast: string;

    status: {
      scheduled: string;
      in_progress: string;
      completed: string;
      canceled_by_school: string;
      canceled_by_student: string;
      rescheduled: string;
      no_show: string;
    };
  };
  /**
   * Facturación (Tarea 10 del panel web): listado con filtro por estado y
   * total del mes, detalle con líneas/cobros/devoluciones y la comisión de
   * plataforma desglosada, emisión de factura, apertura de devolución con
   * motivo, y la pantalla de conexión con el proveedor de pago. Los enums
   * (`status`, `direction`, `paymentMethod`, `paymentStatus`, `refundReason`,
   * `refundStatus`) viven en el nivel de `billing`, no repetidos por
   * pantalla: el listado, el detalle y el formulario de devolución pintan o
   * eligen los mismos valores.
   */
  billing: {
    title: string;
    newInvoice: string;
    monthTotalLabel: string;
    statusLabel: string;
    statusAll: string;
    status: {
      draft: string;
      open: string;
      paid: string;
      past_due: string;
      void: string;
      uncollectible: string;
    };
    direction: {
      school_to_student: string;
      platform_to_school: string;
    };
    paymentMethod: {
      card: string;
      sepa_debit: string;
      bank_transfer: string;
      cash: string;
    };
    paymentStatus: {
      pending: string;
      succeeded: string;
      failed: string;
      refunded: string;
      partially_refunded: string;
    };
    refundReason: {
      requested_by_customer: string;
      service_not_provided: string;
      duplicate: string;
      fraudulent: string;
      goodwill: string;
    };
    refundStatus: {
      pending: string;
      succeeded: string;
      failed: string;
      canceled: string;
    };
    /** `MerchantAccountStatus.merchantStatus` (Paso 4): estado del alta del comerciante ante el proveedor de pago. */
    merchantStatus: {
      not_started: string;
      pending: string;
      active: string;
      restricted: string;
      disabled: string;
    };
    list: {
      caption: string;
      columnNumber: string;
      columnBilledTo: string;
      columnDirection: string;
      columnStatus: string;
      columnTotal: string;
      columnIssuedOn: string;
      columnDueOn: string;
      failedPaymentTag: string;
      billedToPlatform: string;
      emptyTitle: string;
      emptyDescription: string;
      noResultsTitle: string;
      noResultsDescription: string;
      errorTitle: string;
      pageIndicator: string;
      previousPage: string;
      nextPage: string;
    };
    detail: {
      backToList: string;
      notFoundTitle: string;
      loadingTitle: string;
      errorTitle: string;
      numberLabel: string;
      statusLabel: string;
      directionLabel: string;
      billedToLabel: string;
      issuedOnLabel: string;
      dueOnLabel: string;
      paidAtLabel: string;
      notPaidYet: string;
      linesTitle: string;
      columnDescription: string;
      columnQuantity: string;
      columnUnitPrice: string;
      columnLineTotal: string;
      subtotalLabel: string;
      taxLabel: string;
      totalLabel: string;
      feeTitle: string;
      feeRateLabel: string;
      feeAmountLabel: string;
      feeNoneHint: string;
      remainingLabel: string;
      refundableLabel: string;
      paymentsTitle: string;
      paymentsEmptyTitle: string;
      columnPaymentDate: string;
      columnPaymentMethod: string;
      columnPaymentStatus: string;
      columnPaymentAmount: string;
      columnPaymentFee: string;
      paymentFailureReason: string;
      refundsTitle: string;
      refundsEmptyTitle: string;
      columnRefundDate: string;
      columnRefundReason: string;
      columnRefundStatus: string;
      columnRefundAmount: string;
      columnRefundFee: string;
      openRefundAction: string;
    };
    issue: {
      title: string;
      studentLabel: string;
      studentPlaceholder: string;
      studentRequired: string;
      billToLabel: string;
      billToPlaceholder: string;
      billToRequired: string;
      lineDescriptionLabel: string;
      lineDescriptionRequired: string;
      lineQuantityLabel: string;
      lineUnitAmountLabel: string;
      lineUnitAmountRequired: string;
      lineUnitAmountInvalid: string;
      taxRateLabel: string;
      taxRateHint: string;
      dueOnLabel: string;
      dueOnRequired: string;
      close: string;
      submit: string;
      submitting: string;
      success: string;
      genericError: string;
    };
    refund: {
      title: string;
      refundableHint: string;
      amountLabel: string;
      amountRequired: string;
      amountInvalid: string;
      reasonLabel: string;
      reasonRequired: string;
      close: string;
      submit: string;
      submitting: string;
      success: string;
      genericError: string;
    };
    connect: {
      title: string;
      subtitle: string;
      statusLabel: string;
      usableWithoutConnectingTitle: string;
      usableWithoutConnectingDescription: string;
      unlocksTitle: string;
      unlockCharge: string;
      unlockReceipts: string;
      unlockRefunds: string;
      feeSummaryEnabled: string;
      feeSummaryDisabled: string;
      connectAction: string;
      connecting: string;
      reviewAction: string;
      errorTitle: string;
      genericError: string;
    };
  };

  /**
   * Navegación del panel (Tarea 11, Paso 1): distinta según el rol de la
   * sesión activa. No repite las etiquetas de cada pantalla (`dashboard.title`,
   * `students.title`...) porque un enlace de menú es más corto que el título
   * de la pantalla a la que lleva.
   */
  nav: {
    label: string;
    dashboard: string;
    students: string;
    analytics: string;
    leads: string;
    transcripts: string;
    siteEditor: string;
    siteDomains: string;
    calendar: string;
    mySessions: string;
    myInvoices: string;
    myAttendance: string;
    myProgress: string;
    generateContent: string;
    /** Tarea 12 de la ola 2: hacer ejercicios, repaso diario y bandeja de corrección. */
    myExercises: string;
    myReview: string;
    corrections: string;
  };

  leads: {
    title: string;
    metricTotal: string;
    metricPlacementDone: string;
    metricCold: string;
    count: string;
    placementDoneCount: string;
    coldCount: string;
    caption: string;
    columnCandidate: string;
    columnStatus: string;
    columnLevel: string;
    columnSource: string;
    columnCreated: string;
    emptyTitle: string;
    emptyDescription: string;
    errorTitle: string;
    status: {
      new: string;
      placement_sent: string;
      placement_done: string;
      contacted: string;
      converted: string;
      cold: string;
      discarded: string;
    };
  };

  analytics: {
    title: string;
    errorTitle: string;
    satisfaction: {
      title: string;
      nps: string;
      csat: string;
      respondents: string;
      evolution: string;
      teacherRows: string;
      pendingReviews: string;
    };
    risk: {
      title: string;
      caption: string;
      columnStudent: string;
      columnLevel: string;
      columnScore: string;
      columnReasons: string;
      columnAttendance: string;
      emptyTitle: string;
      emptyDescription: string;
      level: { low: string; medium: string; high: string };
      reason: {
        low_attendance: string;
        consecutive_absences: string;
        stale_evaluation: string;
        stale_evaluation_never: string;
        low_progress_rating: string;
        recent_negative_review: string;
        past_due_invoice: string;
        detractor_nps: string;
      };
    };
    productivity: {
      title: string;
      caption: string;
      columnTeacher: string;
      columnOccupancy: string;
      columnStudentsWithoutEvaluation: string;
      columnQuality: string;
      columnOperations: string;
      qualityDetail: string;
      operationsDetail: string;
      emptyTitle: string;
      emptyDescription: string;
    };
    mcp: {
      title: string;
      caption: string;
      columnClient: string;
      columnMember: string;
      columnScopes: string;
      columnStatus: string;
      columnActions: string;
      revoke: string;
      revokeAria: string;
      revokeSuccess: string;
      revokeError: string;
      emptyTitle: string;
      emptyDescription: string;
      status: { active: string; expired: string; revoked: string };
    };
  };

  transcripts: {
    title: string;
    errorTitle: string;
    emptyTitle: string;
    emptyDescription: string;
    listTitle: string;
    openAria: string;
    viewerLabel: string;
    blockedTitle: string;
    blockedFallback: string;
    summaryTitle: string;
    searchLabel: string;
    noSearchResultsTitle: string;
    noSearchResultsDescription: string;
    unknownSpeaker: string;
    status: {
      pending: string;
      recording: string;
      processing: string;
      ready: string;
      blocked_no_consent: string;
      failed: string;
    };
  };

  sites: {
    editor: {
      title: string;
      errorTitle: string;
      emptyTitle: string;
      emptyDescription: string;
      localeLabel: string;
      pageLabel: string;
      blocksLabel: string;
      homePage: string;
      addBlock: string;
      blockPlaceholder: string;
      noBlocksTitle: string;
      noBlocksDescription: string;
      save: string;
      saveSuccess: string;
      publish: string;
      publishSuccess: string;
      unpublish: string;
      unpublishSuccess: string;
      genericError: string;
      previewTitle: string;
      up: string;
      down: string;
      moveUp: string;
      moveDown: string;
      imageRightsWarning: string;
      fieldHeadline: string;
      fieldSubtitle: string;
      fieldImageUrl: string;
      fieldCtaLabel: string;
      fieldCtaHref: string;
      fieldQuestion: string;
      fieldAnswer: string;
      fieldTitle: string;
      fieldSubmitLabel: string;
      fieldText: string;
      fieldIds: string;
      status: { draft: string; published: string; unpublished: string };
      blockType: {
        hero: string;
        courses: string;
        teachers: string;
        pricing: string;
        testimonials: string;
        faq: string;
        contact: string;
        text: string;
      };
    };
    domains: {
      title: string;
      addTitle: string;
      hostnameLabel: string;
      add: string;
      addSuccess: string;
      addError: string;
      errorTitle: string;
      caption: string;
      columnDomain: string;
      columnStatus: string;
      columnTxt: string;
      columnTls: string;
      columnActions: string;
      copy: string;
      copyAria: string;
      copySuccess: string;
      emptyTitle: string;
      emptyDescription: string;
      status: { pending: string; verified: string; failed: string };
      tls: { pending: string; issued: string; noop: string; failed: string };
    };
  };

  /**
   * Portal del alumno (Tarea 11, Paso 1 del brief): `/mi/clases`,
   * `/mi/facturas` y `/mi/asistencia`. `switchStudentLabel` es del selector
   * del Paso 2 (tutor con varios hijos); `roomProvider.*` se repite aquí en
   * vez de compartirse con las claves del calendario porque cada pantalla
   * declara su propio texto (mismo criterio que ya separa
   * `students.attendance.status.*` de `calendar.status.*`).
   */
  portal: {
    switchStudentLabel: string;
    roomProvider: {
      livekit: string;
      zoom: string;
      google_meet: string;
      ms_teams: string;
      in_person: string;
    };
    sessions: {
      title: string;
      columnGroup: string;
      columnTeacher: string;
      teacherUnassigned: string;
      columnStart: string;
      columnStatus: string;
      columnRoom: string;
      columnAction: string;
      joinAction: string;
      emptyTitle: string;
      errorTitle: string;
      status: {
        scheduled: string;
        in_progress: string;
        completed: string;
        canceled_by_school: string;
        canceled_by_student: string;
        rescheduled: string;
        no_show: string;
      };
    };
    attendance: {
      title: string;
      columnDate: string;
      columnGroup: string;
      columnStatus: string;
      emptyTitle: string;
      errorTitle: string;
      status: {
        present: string;
        late: string;
        absent: string;
        excused: string;
      };
    };
    invoices: {
      title: string;
      columnNumber: string;
      columnStatus: string;
      columnTotal: string;
      columnIssuedOn: string;
      columnDueOn: string;
      emptyTitle: string;
      errorTitle: string;
      status: {
        draft: string;
        open: string;
        paid: string;
        past_due: string;
        void: string;
        uncollectible: string;
      };
    };
    /**
     * `/mi/progreso` (Tarea 16 de la ola 2). Solo el título y los estados de
     * la pantalla: el contenido en sí (porcentaje, nota media, destrezas,
     * tendencia, racha) es el bloque `progress.*` de más abajo, compartido
     * con la pestaña de la ficha del alumno.
     */
    progress: {
      title: string;
      emptyTitle: string;
      errorTitle: string;
    };
  };

  /**
   * Aula (Tarea 11, Pasos 3 y 4 del brief): vídeo, audio y participantes
   * sobre LiveKit, o el enlace a la plataforma externa cuando la clase no es
   * de la escuela. `recordingBlocked` interpola `{reason}` —el motivo que ya
   * decidió el servidor (`JoinClassroomSessionHandler`), nunca calculado aquí.
   */
  classroom: {
    title: string;
    missingSessionTitle: string;
    errorTitle: string;
    recordingBlocked: string;
    recordingBlockedReasonUnknown: string;
    connecting: string;
    connectionFailedTitle: string;
    connectionFailedDescription: string;
    connectionFailedDetailLabel: string;
    you: string;
    muteMic: string;
    unmuteMic: string;
    enableCam: string;
    disableCam: string;
    participantsTitle: string;
    externalTitle: string;
    externalDescription: string;
    externalOpenLink: string;
  };

  /**
   * Registro de escuela y puesta en marcha (Tarea 12): la única parte del
   * panel que usa alguien sin sesión ni escuela. `signUp`/`verify` cubren la
   * cuenta de Better Auth (correo verificado obligatorio, Paso 1 del brief de
   * la Tarea 11 backend); `register`, la escuela en sí (Paso 1 de esta
   * tarea); `welcome`/`brandStep`/`languageStep`/`teacherStep`/`courseStep`,
   * el asistente de puesta en marcha (Paso 2); `trial`, el aviso de días de
   * prueba (Paso 3).
   */
  onboarding: {
    signUp: {
      title: string;
      subtitle: string;
      nameLabel: string;
      nameRequired: string;
      emailLabel: string;
      emailRequired: string;
      emailInvalid: string;
      passwordLabel: string;
      passwordRequired: string;
      passwordHint: string;
      submit: string;
      submitting: string;
      genericError: string;
      alreadyHaveAccount: string;
      signInLink: string;
    };
    verify: {
      title: string;
      description: string;
      devHint: string;
      confirmButton: string;
      confirming: string;
      notYetVerified: string;
    };
    register: {
      title: string;
      subtitle: string;
      nameLabel: string;
      nameRequired: string;
      slugLabel: string;
      slugHint: string;
      slugPreview: string;
      slugRequired: string;
      slugChecking: string;
      slugAvailable: string;
      slugUnavailable: string;
      submit: string;
      submitting: string;
      genericError: string;
    };
    welcome: {
      title: string;
      subtitle: string;
      goToDashboard: string;
      errorTitle: string;
    };
    brandStep: {
      title: string;
      description: string;
      nameLabel: string;
      nameRequired: string;
      save: string;
      saving: string;
      skip: string;
      success: string;
      done: string;
      skipped: string;
    };
    languageStep: {
      title: string;
      description: string;
      label: string;
      save: string;
      saving: string;
      skip: string;
      success: string;
      done: string;
      skipped: string;
    };
    teacherStep: {
      title: string;
      description: string;
      emailLabel: string;
      emailRequired: string;
      emailInvalid: string;
      invite: string;
      inviting: string;
      skip: string;
      success: string;
      noEmailHint: string;
      done: string;
      skipped: string;
    };
    courseStep: {
      title: string;
      description: string;
      create: string;
      skip: string;
      done: string;
      skipped: string;
    };
    trial: {
      /** Interpola `{relative}` — `formatRelative(trialEndsAt, locale)`, "dentro de 13 días". */
      banner: string;
    };
  };
  /** Tarea 15 de la ola 2: generación y corrección de exámenes. */
  exams: {
    title: string;
    create: {
      title: string;
      kindLabel: string;
      kindUnitExam: string;
      kindLevelExam: string;
      kindMockOfficial: string;
      studentsLabel: string;
      studentsHint: string;
      titleLabel: string;
      languageLabel: string;
      levelLabel: string;
      unitsLabel: string;
      unitsHint: string;
      durationLabel: string;
      mockFrameworkLabel: string;
      mockFrameworkHint: string;
      submit: string;
      submitting: string;
      success: string;
      genericError: string;
    };
    take: {
      title: string;
      /** Interpola `{minutes}` — minutos restantes hasta `deadlineAt`. */
      remaining: string;
      timeUp: string;
      start: string;
      starting: string;
      writtenPlaceholder: string;
      spokenPlaceholder: string;
      submit: string;
      submitting: string;
      submitted: string;
      genericError: string;
    };
    grade: {
      title: string;
      gradeButton: string;
      grading: string;
      aiScoreLabel: string;
      aiFeedbackLabel: string;
      noAiResult: string;
      scoreLabel: string;
      validate: string;
      validating: string;
      validated: string;
      countsForRecordNotice: string;
      genericError: string;
    };
  };

  /**
   * Generador de contenido (Tarea 11 de la ola 2): formulario de generación
   * con estimación de créditos, revisión de los ejercicios editables uno a
   * uno y publicación. `exerciseType.*` y `skill.*` se comparten entre el
   * formulario y la pantalla de revisión — el mismo tipo se llama igual en
   * los dos sitios.
   */
  content: {
    title: string;
    list: {
      title: string;
      newUnit: string;
      uploadMaterial: string;
      statusLabel: string;
      statusAll: string;
      columnCode: string;
      columnTopic: string;
      columnLanguage: string;
      columnLevel: string;
      columnStatus: string;
      columnCredits: string;
      columnCreatedAt: string;
      caption: string;
      emptyTitle: string;
      emptyDescription: string;
      errorTitle: string;
    };
    status: {
      draft: string;
      in_review: string;
      published: string;
      archived: string;
    };
    source: {
      ai_generated: string;
      uploaded: string;
      hybrid: string;
    };
    exerciseType: {
      cloze: string;
      multiple_choice: string;
      matching: string;
      ordering: string;
      minimal_pairs: string;
      dictation: string;
      shadowing: string;
      listening_comprehension: string;
      reading_comprehension: string;
      written_production: string;
      spoken_production: string;
    };
    skill: {
      listening: string;
      reading: string;
      speaking: string;
      writing: string;
      vocabulary: string;
      grammar: string;
      phonetics: string;
    };
    form: {
      title: string;
      subtitle: string;
      creditsTitle: string;
      balanceLabel: string;
      estimatedCostLabel: string;
      rejectedTitle: string;
      rejectedDescription: string;
      estimateErrorTitle: string;
      codeLabel: string;
      codeRequired: string;
      languageLabel: string;
      languageHint: string;
      languageRequired: string;
      levelLabel: string;
      topicLabel: string;
      topicRequired: string;
      skillsLabel: string;
      skillsRequired: string;
      primaryLocaleLabel: string;
      exerciseTypesLabel: string;
      exerciseTypesRequired: string;
      audioDisabledHint: string;
      sourceMaterialLabel: string;
      sourceMaterialHint: string;
      submit: string;
      submitting: string;
      genericError: string;
      progressTitle: string;
      progressDescription: string;
      /** Interpola `{elapsed}` — mm:ss ya formateado, no un número que ICU tenga que pluralizar. */
      progressElapsed: string;
      leaveWarning: string;
      pendingBannerTitle: string;
      /** Interpola `{code}` y `{relative}` (`formatRelative`, igual que el aviso de días de prueba de onboarding). */
      pendingBannerDescription: string;
      pendingBannerDismiss: string;
      pendingBannerGoToList: string;
    };
    review: {
      backToList: string;
      aiProposesNotice: string;
      metaTopic: string;
      metaCreditsSpent: string;
      metaCreatedAt: string;
      metaSource: string;
      descriptionTitle: string;
      bodyTitle: string;
      resourcesTitle: string;
      videoBetaTitle: string;
      betaNoticeDefault: string;
      exercisesTitle: string;
      exercisesEmpty: string;
      /** Interpola `{position}`. */
      exercisePosition: string;
      requiresValidationTag: string;
      edit: string;
      cancelEdit: string;
      save: string;
      saving: string;
      promptLabel: string;
      solutionLabel: string;
      invalidJson: string;
      updateSuccess: string;
      updateGenericError: string;
      publishTitle: string;
      publishDescription: string;
      groupsLabel: string;
      groupsEmptyHint: string;
      publish: string;
      publishing: string;
      publishSuccess: string;
      publishGenericError: string;
      /** Interpola `{date}` (ya formateada en la zona horaria de la escuela). */
      publishedMeta: string;
      /** Interpola `{date}`. */
      reviewedMeta: string;
      errorTitle: string;
    };

    /**
     * Subida de material propio de la escuela (Tarea 14 de la ola 2). Vive
     * dentro de `content` porque comparte pantalla y vocabulario con el
     * generador: subir el cuaderno de siempre y generar ejercicios encima son
     * dos pasos del mismo trabajo.
     */
    upload: {
      title: string;
      subtitle: string;
      dropzoneTitle: string;
      dropzoneLabel: string;
      dropzoneHint: string;
      fileInputLabel: string;
      /** Interpola `{formats}` — la lista ya unida, no un array. */
      acceptedFormats: string;
      noCreditsHint: string;
      emptyQueue: string;
      /** Interpola `{filename}`. */
      progressLabel: string;
      uploadSuccess: string;
      genericError: string;
      uploaded: string;
      indexed: string;
      notIndexed: string;
      notIndexedHint: string;
      createUnitHint: string;
      createUnit: string;
      creatingUnit: string;
      unitCreated: string;
      goToUnit: string;
    };
  };

  /**
   * Hacer ejercicios (Tarea 12 de la ola 2): `/mi/ejercicios`, `/mi/repaso` y
   * `/correcciones`.
   *
   * No repite `exerciseType.*` ni `skill.*`: esas dos listas ya viven en
   * `content` y nombran exactamente lo mismo —un `cloze` es un «Huecos» tanto
   * en la pantalla de revisión del profesor como en la del alumno que lo hace—,
   * y duplicarlas garantizaría que un día dejen de coincidir en los cinco
   * idiomas.
   */
  exercises: {
    /** Un tipo de ejercicio que este panel todavía no sabe pintar. */
    unsupportedType: string;
    submitGenericError: string;

    /**
     * Reproductor de audio (Paso 2). `unavailable` es el estado real de este
     * entorno: `content_assets.storage_key` no se puede convertir en una URL
     * reproducible sin credenciales de almacenamiento, y el `prompt` solo trae
     * un `audioRef` opaco.
     */
    audio: {
      unavailable: string;
      play: string;
      pause: string;
      speedLabel: string;
      /** Interpola `{rate}` (0,5 · 0,75 · 1 · 1,25 · 1,5). */
      speedOption: string;
      markStart: string;
      markEnd: string;
      /** Interpola `{start}` y `{end}`, ya formateados como «m:ss». */
      segmentRange: string;
      repeatOn: string;
      repeatOff: string;
      clearSegment: string;
      dictationLabel: string;
      shadowingLabel: string;
      listeningLabel: string;
    };

    cloze: {
      /** Interpola `{number}` — el `id` del hueco, el mismo que marca el enunciado. */
      blankLabel: string;
      choosePlaceholder: string;
    };
    matching: {
      choosePlaceholder: string;
    };
    ordering: {
      up: string;
      down: string;
      /** Interpolan `{token}`: la etiqueta accesible dice QUÉ palabra se mueve. */
      moveUp: string;
      moveDown: string;
    };
    minimalPairs: {
      /** Interpola `{number}` y `{contrast}`. */
      itemLegend: string;
    };
    dictation: {
      /** Interpola `{number}`. */
      segmentLabel: string;
    };
    shadowing: {
      /** Interpola `{milliseconds}`. */
      maxDelay: string;
      noRecordingHint: string;
      confirmLabel: string;
    };
    written: {
      /** Interpola `{register}` (el registro que pide el ejercicio: formal, informal…). */
      register: string;
      /** Interpola `{min}` y `{max}`. */
      wordRange: string;
      textLabel: string;
      /** Interpola `{count}`. */
      wordCount: string;
    };
    spoken: {
      /** Interpola `{seconds}`. */
      duration: string;
      transcriptLabel: string;
      noRecordingHint: string;
      /** Interpola `{count}`. */
      wordCount: string;
    };

    /** Espejo de `attempt_status` (`packages/db/src/schema/enums.ts`). */
    attemptStatus: {
      in_progress: string;
      submitted: string;
      ai_graded: string;
      teacher_validated: string;
      returned: string;
    };

    /**
     * Qué ve el alumno tras enviar (Paso 3). `pendingReview` y `aiProposal`
     * son la regla de la ola dicha en voz alta: mientras el profesor no firme,
     * lo que hay es una propuesta, no una nota.
     */
    outcome: {
      /** Interpola `{score}` y `{max}`. */
      corrected: string;
      pendingReview: string;
      /** Interpola `{score}` y `{max}`. */
      aiProposal: string;
    };

    todo: {
      title: string;
      /** Interpola `{unit}` (el código de la unidad) y `{max}` (la puntuación máxima). */
      unitAndScore: string;
      needsTeacherTag: string;
      /** Interpola `{number}` y `{status}` (ya traducido). */
      latestAttempt: string;
      submit: string;
      emptyTitle: string;
      emptyDescription: string;
      errorTitle: string;
    };

    review: {
      title: string;
      /** Interpola `{count}`. */
      dueCount: string;
      /** Interpola `{dueOn}` (ya formateada), `{repetitions}` y `{lapses}`. */
      cardMeta: string;
      exerciseUnavailable: string;
      emptyTitle: string;
      emptyDescription: string;
      errorTitle: string;
    };

    inbox: {
      title: string;
      aiProposesNotice: string;
      /** Interpola `{attempt}`, `{status}` (ya traducido) y `{submittedAt}` (ya formateada). */
      meta: string;
      responseTitle: string;
      responseEmpty: string;
      responseNoAnswer: string;
      /** Interpola `{index}`: una opción que el enunciado ya no tiene. */
      responseUnknownOption: string;
      /** Interpola `{number}` y `{word}`. */
      responseSequenceItem: string;
      /** Interpola `{number}` y `{text}`. */
      responseSegmentItem: string;
      /** Interpola `{left}` y `{right}`. */
      responsePairItem: string;
      responseCompleted: string;
      /** Interpola `{number}` y `{text}`. */
      responseBlankItem: string;
      aiProposalTitle: string;
      /** Interpola `{max}`. */
      scoreLabel: string;
      feedbackLabel: string;
      sign: string;
      return: string;
      returnHint: string;
      genericError: string;
      emptyTitle: string;
      emptyDescription: string;
      errorTitle: string;
    };
  };
}
