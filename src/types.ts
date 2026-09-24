
export type SacramentType = string;

export enum AttendanceType {
  ENCONTRO = 'Encontro',
  MISSA = 'Missa',
  MISSAO = 'Missão',
  RETIRO = 'Retiro',
  PAIS_PADRINHOS = 'Reunião de Pais/Padrinhos',
}

export enum UserRole {
  MONITOR = 'Monitor',
  COORDINATOR = 'Coordenador',
  CATECHIST = 'Catequista',
  PADRE = 'Padre',
}

export interface Catechist {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  sacramentSpecialty?: SacramentType | 'Todos';
  password?: string;
  isDefaultPassword?: boolean;
  birthDate?: string;
}

export interface Student {
  id: string;
  name: string;
  pin: string;
  classId: string;
  sacrament: SacramentType;
  archived?: boolean; // New field
  
  // New Contact Fields
  phone?: string;
  
  // Family
  fatherName?: string;
  fatherPhone?: string;
  fatherEmail?: string;
  motherName?: string;
  motherPhone?: string;
  motherEmail?: string;
  
  // Legal Guardian (if not parents)
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianRelationship?: string;
  
  birthDate?: string;
  
  // Extra fields from registration
  rg?: string;
  cpf?: string;
  isBaptized?: boolean;
  baptismPlace?: string; // Local de batismo
  hasFirstEucaristia?: boolean;
  firstEucaristiaPlace?: string; // Local da 1a comunhão
}

export interface ClassGroup {
  id: string;
  name: string;
  catechistNames: string[];
  catechistIds: string[];
  sacrament: SacramentType;
  meetingDay: number;
  meetingTime: string;
  startDate: string;
  endDate: string;
  meetingDurationMinutes?: number;
  archived?: boolean; // New field
}

export interface AttendanceLog {
  id: string;
  studentId: string;
  timestamp: string;
  type: AttendanceType;
  eventName?: string;
  justification?: string;
  presentParents?: string[];
  photoUrl?: string;
  pendingValidation?: boolean;
  validatedBy?: string;
  validatedAt?: string;
  locationStatus?: 'GPS' | 'MANUAL_SELFIE' | 'ADMIN';
}

export interface ScheduledEvent {
  id: string;
  name: string;
  type: AttendanceType;
  startDate: string;
  endDate: string;
  durationMinutes?: number;
}

export interface MassTime {
  id: string;
  dayOfWeek: number;
  time: string;
  durationMinutes?: number;
}

export interface AttendanceRules {
  minEncontro: number;
  minMissa: number;
}

export interface LocationConfig {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  active: boolean;
  requireForEvents?: boolean;
}

export interface SystemConfig {
  registrationEnabled: boolean;
  sacraments: string[];
  sacramentColors?: Record<string, string>;
  massDurationMinutes?: number;
  meetingDurationMinutes?: number;
}

export interface RecessPeriod {
  id: string;
  name: string;
  sacrament: SacramentType | 'TODOS';
  startDate: string;
  endDate: string;
}

// --- NEW REGISTRATION MODULE TYPES ---

export interface RegistrationCampaign {
  id: string;
  title: string; // Ex: Inscrição Crisma 2026
  sacrament: SacramentType;
  startDate: string; // Provavel inicio
  sacramentDate: string; // Provavel data do sacramento
  meetingOptions: string[]; // Ex: ["Sábado 09:00", "Sábado 16:00", "Domingo 08:00"]
  active: boolean;
  year: number;
}

export interface RegistrationSubmission {
  id: string;
  campaignId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submissionDate: string;
  
  // Child Data
  studentName: string;
  studentPhone?: string; // Added field
  birthDate: string;
  rg?: string;
  cpf?: string;
  
  // Parents/Guardians
  fatherName?: string;
  fatherPhone?: string;
  fatherEmail?: string;
  motherName?: string;
  motherPhone?: string;
  motherEmail?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianRelationship?: string;
  
  // Religious Info
  isBaptized: boolean; // Sim/Não
  baptismPlace?: string;
  hasFirstEucaristia: boolean; // Sim/Não (Só p/ Crisma)
  firstEucaristiaPlace?: string;
  
  // Preference
  preferredMeetingTime: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: 
    | 'DELETE_CLASS' 
    | 'RESTORE_CLASS' 
    | 'CREATE_CLASS'
    | 'UPDATE_CLASS'
    | 'ARCHIVE_CLASS' 
    | 'UNARCHIVE_CLASS' 
    | 'CREATE_STUDENT'
    | 'UPDATE_STUDENT'
    | 'DELETE_STUDENT' 
    | 'RESTORE_STUDENT' 
    | 'CREATE_CATECHIST'
    | 'UPDATE_CATECHIST'
    | 'DELETE_CATECHIST'
    | 'VALIDATE_ATTENDANCE'
    | 'REJECT_ATTENDANCE'
    | 'DELETE_ATTENDANCE'
    | 'UPDATE_ATTENDANCE'
    | 'MANUAL_ATTENDANCE'
    | 'APPROVE_REGISTRATION'
    | 'REJECT_REGISTRATION'
    | 'CREATE_CAMPAIGN'
    | 'UPDATE_CAMPAIGN'
    | 'DELETE_CAMPAIGN'
    | 'CREATE_EVENT'
    | 'UPDATE_EVENT'
    | 'DELETE_EVENT'
    | 'CREATE_MASS_TIME'
    | 'UPDATE_MASS_TIME'
    | 'DELETE_MASS_TIME'
    | 'CREATE_RECESS'
    | 'DELETE_RECESS'
    | 'UPDATE_CONFIG'
    | 'SYSTEM_RECOVERY'
    | string;
  entityType: 'class' | 'student' | 'catechist' | 'attendance' | 'registration' | 'event' | 'config' | string;
  entityId: string;
  entityName: string;
  userEmail: string;
  userName: string;
  userRole?: string;
  details?: string;
  snapshot?: any;
  undone?: boolean;
  undoneAt?: string;
  undoneBy?: string;
}

export interface AppState {
  students: Student[];
  classes: ClassGroup[];
  attendance: AttendanceLog[];
  scheduledEvents: ScheduledEvent[];
  massTimes: MassTime[];
  catechists: Catechist[];
  requirements: Record<SacramentType, AttendanceRules>;
  recessPeriods: RecessPeriod[];
  locationConfig: LocationConfig;
  systemConfig: SystemConfig;
  registrationCampaigns: RegistrationCampaign[];
  registrationSubmissions: RegistrationSubmission[];
  auditLogs: AuditLog[];
}
