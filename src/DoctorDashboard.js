import React, { useState, useEffect, useCallback } from 'react';
import PatientGameConnectPage from './PatientGameConnectPage';
import { supabase } from './supabaseClient';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';


const DoctorDashboard = ({ user, onLogout }) => {
  const [currentView, setCurrentView] = useState('patients'); // 'patients', 'records', 'editPatient', 'pairing'
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPatient, setEditingPatient] = useState(null);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [showDisabilityInfo, setShowDisabilityInfo] = useState(false);

  // 復健紀錄相關狀態
  const [rehabSessions, setRehabSessions] = useState([]);
  const [rehabSessionStats, setRehabSessionStats] = useState({});
  const [rehabLoading, setRehabLoading] = useState(false);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteHistory, setNoteHistory] = useState([]);

  // 動作障礙等級說明
  const disabilityLevels = [
    { value: '0', label: '等級0', description: '沒有任何症狀' },
    { value: '1', label: '等級1', description: '有症狀但沒有明顯障礙並不影響日常生活及工作能力' },
    { value: '2', label: '等級2', description: '輕度障礙,會影響工作能力,但日常生活起居可以完全自理' },
    { value: '3', label: '等級3', description: '中度障礙,日常生活起居需要他人協助,但可以自行走動' },
    { value: '4', label: '等級4', description: '中重度障礙,日常生活起居和行走都需要他人協助' },
    { value: '5', label: '等級5', description: '重度障礙,臥床,大小便失禁,完全沒有生活自理能力,需要他人照護' }
  ];

  const GAME_KEY_LABELS = {
    single_color: '單色積木',
    multi_color: '多色積木',
    shapes_single: '圖形（單色）',
    shapes_multi_color: '圖形（多色）',
    thin_circle: '細圓環',
  };

  const CHART_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9', '#8B5CF6'];

  // 載入病患復健資料
  const loadRehabData = useCallback(async (patient) => {
    if (!patient) return;
    setRehabLoading(true);
    try {
      const patientId = patient.id;
      const username = patient.username;

      // 載入遊戲場次
      const { data: sessionsData, error } = await supabase
        .from('game_sessions')
        .select('*')
        .or(`patient_id.eq.${patientId},patient_id.eq.${username}`)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.error('載入復健資料錯誤:', error);
        setRehabSessions([]);
        return;
      }

      setRehabSessions(sessionsData || []);

      // 為每個場次計算統計
      if (sessionsData && sessionsData.length > 0) {
        const statsMap = {};
        await Promise.all(
          sessionsData.map(async (s) => {
            const { data: acts } = await supabase
              .from('game_actions')
              .select('action_type')
              .eq('session_id', s.id);
            if (acts) {
              statsMap[s.id] = acts.reduce(
                (acc, a) => {
                  if (a.action_type === 'tap_correct') acc.correct += 1;
                  else if (a.action_type === 'tap_wrong') acc.wrong += 1;
                  else if (a.action_type === 'auto_miss') acc.autoMiss += 1;
                  acc.total += 1;
                  return acc;
                },
                { correct: 0, wrong: 0, autoMiss: 0, total: 0 }
              );
            }
          })
        );
        setRehabSessionStats(statsMap);
      }

      // 載入醫師評估備註 (從 user_health_records 的 medications 欄位暫存，或使用 notes)
      await loadDoctorNotes(patientId);
    } catch (err) {
      console.error('載入復健資料異常:', err);
    } finally {
      setRehabLoading(false);
    }
  }, []);

  // 載入醫師備註
  const loadDoctorNotes = async (patientId) => {
    try {
      const { data } = await supabase
        .from('doctor_notes')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) {
        setNoteHistory(data);
      }
    } catch {
      // 如果 doctor_notes 表不存在，靜默處理
      setNoteHistory([]);
    }
  };

  // 儲存醫師備註
  const saveDoctorNote = async () => {
    if (!doctorNotes.trim() || !selectedPatient) return;
    setNoteSaving(true);
    try {
      const { error } = await supabase
        .from('doctor_notes')
        .insert({
          patient_id: selectedPatient.id,
          doctor_id: user.id,
          doctor_name: doctorProfile?.full_name || user.email,
          note: doctorNotes.trim(),
        });
      if (error) {
        console.error('儲存備註錯誤:', error);
        alert('儲存備註失敗，請確認 doctor_notes 資料表已建立');
      } else {
        alert('備註儲存成功！');
        setDoctorNotes('');
        await loadDoctorNotes(selectedPatient.id);
      }
    } catch (err) {
      console.error('儲存備註異常:', err);
      alert('儲存備註失敗');
    } finally {
      setNoteSaving(false);
    }
  };

  const loadDoctorProfile = useCallback(async () => {
    try {
      // 獲取當前醫生的資料
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('獲取醫生資料錯誤:', error);
      } else {
        setDoctorProfile(data);
      }
    } catch (err) {
      console.error('獲取醫生資料異常:', err);
    }
  }, [user.id]);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      console.log('🔍 開始載入病患，用戶資料:', user);
      console.log('🔍 用戶 ID:', user.id);
      console.log('🔍 用戶 Email:', user.email);
      
      // 先查詢所有醫生來瞭解資料結構
      console.log('🔍 查詢所有醫生資料...');
      const { data: allDoctors, error: allDoctorsError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_type', 'doctor');
      
      console.log('🔍 所有醫生資料:', allDoctors);
      console.log('🔍 查詢錯誤:', allDoctorsError);
      
      let doctorUsername = null;
      let currentDoctorProfile = null;
      
      // 方法 1: 通過 user_id 查詢（如果是 Auth 用戶）
      if (user.id) {
        console.log('🔍 嘗試通過 user_id 查詢:', user.id);
        const { data: doctorByUserId, error: userIdError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .eq('user_type', 'doctor');

        console.log('🔍 通過 user_id 查詢結果:', doctorByUserId);
        console.log('🔍 通過 user_id 查詢錯誤:', userIdError);

        if (!userIdError && doctorByUserId && doctorByUserId.length > 0) {
          console.log('✅ 通過 user_id 找到醫生:', doctorByUserId[0]);
          doctorUsername = doctorByUserId[0].username;
          currentDoctorProfile = doctorByUserId[0];
        }
      }
      
      // 方法 2: 通過 email 查詢
      if (!doctorUsername && user.email) {
        console.log('🔍 嘗試通過 email 查詢:', user.email);
        const { data: doctorByEmail, error: emailError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', user.email)
          .eq('user_type', 'doctor');

        console.log('🔍 通過 email 查詢結果:', doctorByEmail);
        console.log('🔍 通過 email 查詢錯誤:', emailError);

        if (!emailError && doctorByEmail && doctorByEmail.length > 0) {
          console.log('✅ 通過 email 找到醫生:', doctorByEmail[0]);
          doctorUsername = doctorByEmail[0].username;
          currentDoctorProfile = doctorByEmail[0];
        }
      }
      
      // 方法 3: 如果前兩種方法都失敗，臨時使用 doc001
      if (!doctorUsername) {
        console.log('🔍 前兩種方法都失敗，嘗試直接使用 doc001');
        
        if (allDoctors && allDoctors.length > 0) {
          const doc001 = allDoctors.find(doctor => doctor.username === 'doc001');
          if (doc001) {
            console.log('✅ 找到 doc001，臨時使用:', doc001);
            doctorUsername = doc001.username;
            currentDoctorProfile = doc001;
          } else {
            // 使用第一個找到的醫生
            console.log('⚠️ 找不到 doc001，使用第一個醫生:', allDoctors[0]);
            currentDoctorProfile = allDoctors[0];
            doctorUsername = currentDoctorProfile.username;
          }
        }
      }

      console.log('🎯 最終確定的醫生 username:', doctorUsername);
      console.log('🎯 醫生資料:', currentDoctorProfile);
      
      if (!doctorUsername) {
        console.error('❌ 仍然無法獲取醫生 username');
        console.log('📊 可用的醫生列表:', allDoctors);
        setPatients([]);
        setLoading(false);
        return;
      }

      // 設定醫生資料
      setDoctorProfile(currentDoctorProfile);

      // 查詢分配給這個醫生的病患 - 使用 LEFT JOIN 確保即使沒有健康記錄也能獲取病患
      console.log('🔍 開始查詢病患，assigned_doctor =', doctorUsername);
      
      const { data: patientProfiles, error } = await supabase
        .from('user_profiles')
        .select(`
          *,
          user_health_records!left (*)
        `)
        .eq('user_type', 'general')
        .eq('verification_status', 'verified')
        .eq('assigned_doctor', doctorUsername)
        .order('created_at', { ascending: false });

      console.log('🔍 病患查詢結果:', patientProfiles);
      console.log('🔍 病患查詢錯誤:', error);

      if (error) {
        console.error('❌ 載入病患錯誤:', error);
        setPatients([]);
      } else {
        // 為每個病患生成病患編號和整理資料
        const patientsWithId = patientProfiles.map((patient, index) => {
          // 嘗試匹配健康記錄 - 可能通過 user_profile_id 或其他方式
          let healthRecord = null;
          
          if (patient.user_health_records && patient.user_health_records.length > 0) {
            healthRecord = patient.user_health_records[0];
          }
          
          return {
            ...patient,
            patient_number: `${doctorUsername?.toUpperCase()}-P${String(index + 1).padStart(3, '0')}`,
            health_record: healthRecord
          };
        });
        
        setPatients(patientsWithId);
        console.log('✅ 成功載入病患:', {
          doctorUsername: doctorUsername,
          patientCount: patientsWithId.length,
          patients: patientsWithId.map(p => ({ 
            username: p.username, 
            name: p.full_name,
            has_health_record: !!p.health_record 
          }))
        });
      }
    } catch (err) {
      console.error('❌ 載入病患異常:', err);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDoctorProfile();
    loadPatients();
  }, [loadDoctorProfile, loadPatients]);

  // 篩選病患
  const filteredPatients = patients.filter(patient =>
    patient.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.patient_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 編輯病患資料
  const handleEditPatient = (patient) => {
    // 解析 medical_conditions 中的病況（排除特殊標記）
    let medicalConditions = [];
    
    if (patient.health_record?.medical_conditions) {
      // 如果是陣列格式
      if (Array.isArray(patient.health_record.medical_conditions)) {
        medicalConditions = patient.health_record.medical_conditions.filter(condition => 
          !condition.startsWith('中風級別:') && 
          !condition.startsWith('動作障礙等級:') &&
          !condition.startsWith('生日:') &&
          !condition.startsWith('身高:') &&
          !condition.startsWith('體重:')
        );
      } else if (typeof patient.health_record.medical_conditions === 'string') {
        // 如果是字串格式（從 text 欄位讀取）
        medicalConditions = patient.health_record.medical_conditions.split(',').map(s => s.trim());
      }
    }

    setEditingPatient({
      ...patient,
      // 基本資料
      full_name: patient.full_name || '',
      surname: patient.surname || '',
      birth_date: patient.health_record?.birth_date || '',
      age: patient.health_record?.age || '',
      phone: patient.phone || '',
      
      // 身體資料 - 現在直接從資料庫欄位讀取
      height: patient.health_record?.height || '',
      weight: patient.health_record?.weight || '',
      gender: patient.health_record?.gender || '',
      
      // 病況資料 - 現在直接從資料庫欄位讀取
      stroke_level: patient.health_record?.stroke_level || '',
      disability_level: patient.health_record?.disability_level || '0',
      medical_conditions: medicalConditions.join(', '),
      medications: Array.isArray(patient.health_record?.medications) ? 
        patient.health_record.medications.join(', ') : 
        patient.health_record?.medications || '',
      
      // 緊急聯絡人
      emergency_contact_name: patient.health_record?.emergency_contact_name || '',
      emergency_contact_phone: patient.health_record?.emergency_contact_phone || ''
    });
    setCurrentView('editPatient');
  };

  // 計算年齡
  const calculateAge = (birthDate) => {
    if (!birthDate || birthDate.length !== 8) return '';
    
    const year = parseInt(birthDate.substring(0, 4));
    const month = parseInt(birthDate.substring(4, 6));
    const day = parseInt(birthDate.substring(6, 8));
    
    const today = new Date();
    const birth = new Date(year, month - 1, day);
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  // 處理生日變更
  const handleBirthDateChange = (value) => {
    setEditingPatient({
      ...editingPatient,
      birth_date: value,
      age: calculateAge(value).toString()
    });
  };

  // 保存病患資料
  const handleSavePatient = async () => {
    if (!editingPatient) return;

    setLoading(true);
    try {
      // 更新 user_profiles
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          full_name: editingPatient.full_name,
          surname: editingPatient.surname,
          phone: editingPatient.phone
        })
        .eq('id', editingPatient.id);

      if (profileError) {
        console.error('更新病患基本資料錯誤:', profileError);
        alert('更新基本資料失敗');
        return;
      }

      // 準備 medical_conditions 資料（現在只包含真正的病況）
      let medicalConditionsArray = [];
      
      // 只加入真正的病況，不包含特殊欄位
      if (editingPatient.medical_conditions) {
        medicalConditionsArray = editingPatient.medical_conditions
          .split(',')
          .map(s => s.trim())
          .filter(s => s && 
            !s.startsWith('中風級別:') && 
            !s.startsWith('動作障礙等級:') &&
            !s.startsWith('生日:') &&
            !s.startsWith('身高:') &&
            !s.startsWith('體重:'));
      }
	  
	  const medicationsArray = editingPatient.medications
  ? editingPatient.medications.split(',').map(s => s.trim()).filter(Boolean)
  : [];

      // 準備健康記錄資料 - 現在包含所有新欄位
      const healthData = {
        age: parseInt(editingPatient.age) || null,
        gender: editingPatient.gender || null,
        birth_date: editingPatient.birth_date || null,
        height: editingPatient.height ? parseFloat(editingPatient.height) : null,
        weight: editingPatient.weight ? parseFloat(editingPatient.weight) : null,
        stroke_level: editingPatient.stroke_level || null,
        disability_level: editingPatient.disability_level || null,
        //medical_conditions: medicalConditionsArray.join(', '), // 存為 text 格式
		// ★ 關鍵：若欄位型別是 text[]，就傳陣列；空的時候傳 null（或 []）
		medical_conditions: medicalConditionsArray.length ? medicalConditionsArray : null,
        //medications: editingPatient.medications || null, // 存為 text 格式
		 medications: medicationsArray.length ? medicationsArray : null,
        emergency_contact_name: editingPatient.emergency_contact_name || null,
        emergency_contact_phone: editingPatient.emergency_contact_phone || null
      };

      console.log('準備更新的健康記錄資料:', healthData);


      // …前面 healthData 的整理保留…
		healthData.user_id = editingPatient.id; // 關鍵：寫入對應關係

		// 檢查是否已有健康記錄（以 user_id 對應 profile.id）
		const { data: existingRecord, error: existErr } = await supabase
		  .from('user_health_records')
		  .select('id')
		  .eq('user_id', editingPatient.id)
		  .maybeSingle();

		if (existErr) {
		  console.error('檢查健康記錄錯誤:', existErr);
		  alert('檢查健康記錄失敗');
		  return;
		}

		if (existingRecord) {
		  // 用資料表主鍵 id 來更新
		  const { error: updateError } = await supabase
			.from('user_health_records')
			.update(healthData)
			.eq('id', existingRecord.id);

		  if (updateError) {
			console.error('更新健康記錄錯誤:', updateError);
			alert('更新健康記錄失敗');
			return;
		  }
		} else {
		  // 沒有就新增（healthData 內已含 user_id）
		  const { error: insertError } = await supabase
			.from('user_health_records')
			.insert(healthData);

		  if (insertError) {
			console.error('新增健康記錄錯誤:', insertError);
			alert('新增健康記錄失敗');
			return;
		  }
		}
      

      alert('病患資料更新成功！');
      setCurrentView('patients');
      setEditingPatient(null);
      loadPatients(); // 重新載入列表
    } catch (err) {
      console.error('保存病患資料異常:', err);
      alert('保存失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // CSS 樣式
  const styles = {
    dashboard: {
      minHeight: '100vh',
      backgroundColor: '#F9FAFB'
    },
    navbar: {
      backgroundColor: 'white',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      padding: '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    navTitle: {
      fontSize: '20px',
      fontWeight: 'bold',
      color: '#1F2937'
    },
    logoutButton: {
      backgroundColor: '#DC2626',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer'
    },
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px'
    },
    tabs: {
      display: 'flex',
      marginBottom: '24px',
      borderBottom: '2px solid #E5E7EB'
    },
    tab: (active) => ({
      padding: '12px 24px',
      backgroundColor: active ? '#4F46E5' : 'transparent',
      color: active ? 'white' : '#6B7280',
      border: 'none',
      borderRadius: '8px 8px 0 0',
      cursor: 'pointer',
      fontWeight: '500',
      marginRight: '8px'
    }),
    searchContainer: {
      marginBottom: '24px'
    },
    searchInput: {
      width: '100%',
      maxWidth: '400px',
      padding: '12px 16px',
      border: '1px solid #D1D5DB',
      borderRadius: '8px',
      fontSize: '16px'
    },
    patientGrid: {
      display: 'grid',
      gap: '16px'
    },
    patientCard: {
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      border: '1px solid #E5E7EB',
      transition: 'all 0.2s'
    },
    patientInfo: {
      flex: 1
    },
    patientNumber: {
      fontSize: '14px',
      color: '#6B7280',
      fontWeight: '500'
    },
    patientName: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#1F2937',
      margin: '4px 0'
    },
    patientDetails: {
      fontSize: '14px',
      color: '#6B7280'
    },
    actionButtons: {
      display: 'flex',
      gap: '8px'
    },
    button: (variant = 'primary') => ({
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '500',
      backgroundColor: variant === 'primary' ? '#4F46E5' : 
                     variant === 'secondary' ? '#F3F4F6' :
                     variant === 'warning' ? '#F59E0B' : '#10B981',
      color: variant === 'secondary' ? '#374151' : 'white'
    }),
    editForm: {
      backgroundColor: 'white',
      padding: '24px',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    },
    formSection: {
      marginBottom: '32px',
      borderBottom: '1px solid #E5E7EB',
      paddingBottom: '24px'
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#1F2937',
      marginBottom: '16px'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '20px'
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column'
    },
    label: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      marginBottom: '6px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    input: {
      padding: '10px 12px',
      border: '1px solid #D1D5DB',
      borderRadius: '6px',
      fontSize: '16px'
    },
    select: {
      padding: '10px 12px',
      border: '1px solid #D1D5DB',
      borderRadius: '6px',
      fontSize: '16px',
      backgroundColor: 'white'
    },
    textarea: {
      padding: '10px 12px',
      border: '1px solid #D1D5DB',
      borderRadius: '6px',
      fontSize: '16px',
      minHeight: '80px',
      resize: 'vertical'
    },
    fullWidth: {
      gridColumn: '1 / -1'
    },
    infoButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: '#3B82F6',
      fontSize: '16px',
      padding: '0 4px',
      fontWeight: 'bold'
    },
    tooltip: {
      position: 'fixed',
      backgroundColor: 'rgba(31, 41, 55, 0.95)',
      color: 'white',
      padding: '12px',
      borderRadius: '8px',
      maxWidth: '400px',
      fontSize: '14px',
      zIndex: 1000,
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: '#6B7280'
    },
    loadingState: {
      textAlign: 'center',
      padding: '40px',
      color: '#6B7280'
    }
  };

  // 渲染病患列表
  const renderPatientsList = () => (
    <div>
      {/* 搜尋框 */}
      <div style={styles.searchContainer}>
        <input
          type="text"
          placeholder="搜尋病患姓名、身分證字號或病患編號..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* 病患列表 */}
      <div style={styles.patientGrid}>
        {loading ? (
          <div style={styles.loadingState}>載入中...</div>
        ) : filteredPatients.length === 0 ? (
          <div style={styles.emptyState}>
            {searchTerm ? '找不到符合的病患' : '尚無分配給您的病患'}
            {!searchTerm && (
              <p style={{ marginTop: '8px' }}>
                {doctorProfile?.username ? 
                  `分配給 ${doctorProfile.username} 的病患會顯示在這裡` : 
                  '分配給您的病患會顯示在這裡'
                }
              </p>
            )}
          </div>
        ) : (
          filteredPatients.map((patient) => {
            return (
              <div key={patient.id} style={styles.patientCard}>
                <div style={styles.patientInfo}>
                  <div style={styles.patientNumber}>病患編號: {patient.patient_number}</div>
                  <div style={styles.patientName}>{patient.full_name || patient.surname}</div>
                  <div style={styles.patientDetails}>
                    身分證: {patient.username} | 
                    年齡: {patient.health_record?.age || '未設定'} | 
                    性別: {patient.health_record?.gender || '未設定'}
                    {patient.health_record?.stroke_level && ` | 中風級別: ${patient.health_record.stroke_level}`}
                    {patient.phone && ` | 電話: ${patient.phone}`}
                  </div>
                </div>
                <div style={styles.actionButtons}>
                  <button
                    onClick={() => handleEditPatient(patient)}
                    style={styles.button('primary')}
                  >
                    編輯資料
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPatient(patient);
                      setCurrentView('records');
                      loadRehabData(patient);
                    }}
                    style={styles.button('success')}
                  >
                    復健紀錄
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPatient(patient);
                      setCurrentView('pairing');
                    }}
                    style={styles.button('warning')}
                  >
                    遊戲配對
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // 渲染編輯表單
  const renderEditForm = () => {
    if (!editingPatient) return null;

    return (
      <div style={styles.editForm}>
        <h2 style={{ marginBottom: '24px', color: '#1F2937' }}>
          編輯病患資料 - {editingPatient.patient_number}
        </h2>
        
        {/* 基本資料區塊 */}
        <div style={styles.formSection}>
          <h3 style={styles.sectionTitle}>基本資料</h3>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>姓名 *</label>
              <input
                type="text"
                value={editingPatient.full_name || ''}
                onChange={(e) => setEditingPatient({...editingPatient, full_name: e.target.value})}
                style={styles.input}
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>身分證字號</label>
              <input
                type="text"
                value={editingPatient.username || ''}
                disabled
                style={{...styles.input, backgroundColor: '#F3F4F6', cursor: 'not-allowed'}}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>生日 (8碼)</label>
              <input
                type="text"
                value={editingPatient.birth_date || ''}
                onChange={(e) => handleBirthDateChange(e.target.value)}
                placeholder="19900101"
                maxLength={8}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>年齡</label>
              <input
                type="number"
                value={editingPatient.age || ''}
                onChange={(e) => setEditingPatient({...editingPatient, age: e.target.value})}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>性別</label>
              <select
                value={editingPatient.gender || ''}
                onChange={(e) => setEditingPatient({...editingPatient, gender: e.target.value})}
                style={styles.select}
              >
                <option value="">請選擇</option>
                <option value="男">男</option>
                <option value="女">女</option>
                <option value="其他">其他</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>聯絡電話</label>
              <input
                type="tel"
                value={editingPatient.phone || ''}
                onChange={(e) => setEditingPatient({...editingPatient, phone: e.target.value})}
                placeholder="0912345678"
                style={styles.input}
              />
            </div>
          </div>
        </div>

        {/* 身體數據區塊 */}
        <div style={styles.formSection}>
          <h3 style={styles.sectionTitle}>身體數據</h3>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>身高 (公分)</label>
              <input
                type="number"
                value={editingPatient.height || ''}
                onChange={(e) => setEditingPatient({...editingPatient, height: e.target.value})}
                placeholder="170"
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>體重 (公斤)</label>
              <input
                type="number"
                value={editingPatient.weight || ''}
                onChange={(e) => setEditingPatient({...editingPatient, weight: e.target.value})}
                placeholder="70"
                step="0.1"
                style={styles.input}
              />
            </div>
          </div>
        </div>

        {/* 病況評估區塊 */}
        <div style={styles.formSection}>
          <h3 style={styles.sectionTitle}>病況評估</h3>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>中風級別</label>
              <select
                value={editingPatient.stroke_level || ''}
                onChange={(e) => setEditingPatient({...editingPatient, stroke_level: e.target.value})}
                style={styles.select}
              >
                <option value="">請選擇</option>
                <option value="輕度">輕度</option>
                <option value="中度">中度</option>
                <option value="重度">重度</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                動作障礙等級
                <button
                  type="button"
                  style={styles.infoButton}
                  onMouseEnter={() => setShowDisabilityInfo(true)}
                  onMouseLeave={() => setShowDisabilityInfo(false)}
                >
                  ⓘ
                </button>
              </label>
              <select
                value={editingPatient.disability_level || '0'}
                onChange={(e) => setEditingPatient({...editingPatient, disability_level: e.target.value})}
                style={styles.select}
              >
                {disabilityLevels.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label} - {level.description}
                  </option>
                ))}
              </select>
            </div>

            <div style={{...styles.formGroup, ...styles.fullWidth}}>
              <label style={styles.label}>病例狀況 (用逗號分隔)</label>
              <textarea
                value={editingPatient.medical_conditions || ''}
                onChange={(e) => setEditingPatient({...editingPatient, medical_conditions: e.target.value})}
                placeholder="例如：高血壓, 糖尿病, 心臟病"
                style={styles.textarea}
              />
            </div>

            <div style={{...styles.formGroup, ...styles.fullWidth}}>
              <label style={styles.label}>用藥記錄 (用逗號分隔)</label>
              <textarea
                value={editingPatient.medications || ''}
                onChange={(e) => setEditingPatient({...editingPatient, medications: e.target.value})}
                placeholder="例如：降血壓藥, 胰島素, 阿斯匹靈"
                style={styles.textarea}
              />
            </div>
          </div>
        </div>

        {/* 緊急聯絡人區塊 */}
        <div style={{...styles.formSection, borderBottom: 'none'}}>
          <h3 style={styles.sectionTitle}>緊急聯絡人</h3>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>緊急聯絡人姓名</label>
              <input
                type="text"
                value={editingPatient.emergency_contact_name || ''}
                onChange={(e) => setEditingPatient({...editingPatient, emergency_contact_name: e.target.value})}
                placeholder="王太太"
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>緊急聯絡人電話</label>
              <input
                type="tel"
                value={editingPatient.emergency_contact_phone || ''}
                onChange={(e) => setEditingPatient({...editingPatient, emergency_contact_phone: e.target.value})}
                placeholder="0923456789"
                style={styles.input}
              />
            </div>
          </div>
        </div>

        {/* 動作按鈕 */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button
            onClick={() => {
              setCurrentView('patients');
              setEditingPatient(null);
            }}
            style={styles.button('secondary')}
          >
            取消
          </button>
          <button
            onClick={handleSavePatient}
            disabled={loading}
            style={styles.button('primary')}
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>

        {/* 動作障礙等級提示框 */}
        {showDisabilityInfo && (
          <div style={styles.tooltip}>
            <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 'bold' }}>
              動作障礙程度分級說明
            </h4>
            {disabilityLevels.map(level => (
              <div key={level.value} style={{ marginBottom: '8px' }}>
                <strong>{level.label}:</strong> {level.description}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 渲染遊戲配對與即時監看
  const renderPairing = () => {
    if (!selectedPatient) {
      return (
        <div style={styles.editForm}>
          <h3>病患遊戲連線</h3>
          <p style={{ color: '#6B7280', marginTop: '12px' }}>請先從病患列表選擇一位病患，再建立配對碼。</p>
          <button
            onClick={() => setCurrentView('patients')}
            style={{ ...styles.button('secondary'), marginTop: '20px' }}
          >
            返回病患列表
          </button>
        </div>
      );
    }

    return (
      <PatientGameConnectPage
        patient={selectedPatient}
        user={user}
        onBack={() => setCurrentView('patients')}
      />
    );
  };

  // 渲染復健紀錄（含圖表）
  const renderRecords = () => {
    if (!selectedPatient) {
      return (
        <div style={styles.editForm}>
          <p style={{ color: '#6B7280' }}>請先從病患列表選擇一位病患。</p>
          <button onClick={() => setCurrentView('patients')} style={{ ...styles.button('secondary'), marginTop: '20px' }}>
            返回病患列表
          </button>
        </div>
      );
    }

    // 計算整體統計
    const overallStats = rehabSessions.reduce(
      (acc, s) => {
        const st = rehabSessionStats[s.id];
        if (st) {
          acc.correct += st.correct;
          acc.wrong += st.wrong;
          acc.autoMiss += st.autoMiss;
          acc.total += st.total;
        }
        if (s.status === 'ended') acc.completedSessions += 1;
        return acc;
      },
      { correct: 0, wrong: 0, autoMiss: 0, total: 0, completedSessions: 0 }
    );
    const overallAccuracy =
      overallStats.correct + overallStats.wrong > 0
        ? Math.round((overallStats.correct / (overallStats.correct + overallStats.wrong)) * 100)
        : 0;

    // 準備進度圖表資料（按日期排列的正確率趨勢）
    const progressData = rehabSessions
      .filter(s => rehabSessionStats[s.id] && (rehabSessionStats[s.id].correct + rehabSessionStats[s.id].wrong) > 0)
      .map((s, idx) => {
        const st = rehabSessionStats[s.id];
        const acc = Math.round((st.correct / (st.correct + st.wrong)) * 100);
        return {
          name: `#${idx + 1}`,
          date: s.created_at ? new Date(s.created_at).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }) : '',
          正確率: acc,
          正確: st.correct,
          錯誤: st.wrong,
          超時: st.autoMiss,
        };
      });

    // 準備運動項目統計（按遊戲類型分組）
    const gameTypeStats = {};
    rehabSessions.forEach(s => {
      const key = s.current_game_key || 'unknown';
      if (!gameTypeStats[key]) {
        gameTypeStats[key] = { name: GAME_KEY_LABELS[key] || key, 場次: 0, 正確: 0, 錯誤: 0, 超時: 0 };
      }
      gameTypeStats[key].場次 += 1;
      const st = rehabSessionStats[s.id];
      if (st) {
        gameTypeStats[key].正確 += st.correct;
        gameTypeStats[key].錯誤 += st.wrong;
        gameTypeStats[key].超時 += st.autoMiss;
      }
    });
    const gameTypeData = Object.values(gameTypeStats);

    // 完成度圓餅圖資料
    const completionData = [
      { name: '已完成', value: overallStats.completedSessions },
      { name: '未完成', value: rehabSessions.length - overallStats.completedSessions },
    ].filter(d => d.value > 0);

    const actionPieData = [
      { name: '正確', value: overallStats.correct },
      { name: '錯誤', value: overallStats.wrong },
      { name: '超時', value: overallStats.autoMiss },
    ].filter(d => d.value > 0);

    const completionColors = ['#10B981', '#D1D5DB'];
    const actionColors = ['#10B981', '#EF4444', '#F59E0B'];

    const chartCardStyle = {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '20px',
    };

    const statCardStyle = (color) => ({
      flex: '1 1 140px',
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '16px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      borderTop: `4px solid ${color}`,
      textAlign: 'center',
    });

    return (
      <div>
        {/* 標題列 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1F2937', margin: 0 }}>
              復健紀錄 - {selectedPatient.full_name}
            </h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>
              病患編號: {selectedPatient.patient_number} | 共 {rehabSessions.length} 次訓練
            </p>
          </div>
          <button onClick={() => setCurrentView('patients')} style={styles.button('secondary')}>
            返回病患列表
          </button>
        </div>

        {rehabLoading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#6B7280' }}>載入復健資料中...</div>
        ) : rehabSessions.length === 0 ? (
          <div style={{ ...chartCardStyle, textAlign: 'center', padding: '60px', color: '#6B7280' }}>
            此病患尚無訓練記錄
          </div>
        ) : (
          <>
            {/* ===== 整體統計卡片 ===== */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <div style={statCardStyle('#4F46E5')}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: '#1F2937' }}>{rehabSessions.length}</div>
                <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>總訓練次數</div>
              </div>
              <div style={statCardStyle('#10B981')}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: '#1F2937' }}>{overallStats.completedSessions}</div>
                <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>完成場次</div>
              </div>
              <div style={statCardStyle('#0EA5E9')}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: '#1F2937' }}>{overallStats.correct}</div>
                <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>正確次數</div>
              </div>
              <div style={statCardStyle('#EF4444')}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: '#1F2937' }}>{overallStats.wrong + overallStats.autoMiss}</div>
                <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>錯誤 / 超時</div>
              </div>
              <div style={statCardStyle('#F59E0B')}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: '#1F2937' }}>{overallAccuracy}%</div>
                <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>整體正確率</div>
              </div>
            </div>

            {/* ===== 復健進度圖表 ===== */}
            <div style={chartCardStyle}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', marginBottom: '16px' }}>
                復健進度趨勢
              </h3>
              {progressData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B7280' }} unit="%" />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                      formatter={(value, name) => [name === '正確率' ? `${value}%` : value, name]}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="正確率" stroke="#4F46E5" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="正確" stroke="#10B981" strokeWidth={1.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="錯誤" stroke="#EF4444" strokeWidth={1.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '40px' }}>尚無足夠資料繪製圖表</p>
              )}
            </div>

            {/* ===== 運動項目記錄 ===== */}
            <div style={chartCardStyle}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', marginBottom: '16px' }}>
                運動項目記錄
              </h3>
              {gameTypeData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={gameTypeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                      <Legend />
                      <Bar dataKey="正確" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="錯誤" fill="#EF4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="超時" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  {/* 運動項目明細表格 */}
                  <div style={{ marginTop: '16px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                          <th style={{ padding: '10px', textAlign: 'left', color: '#374151' }}>遊戲類型</th>
                          <th style={{ padding: '10px', textAlign: 'center', color: '#374151' }}>場次數</th>
                          <th style={{ padding: '10px', textAlign: 'center', color: '#10B981' }}>正確</th>
                          <th style={{ padding: '10px', textAlign: 'center', color: '#EF4444' }}>錯誤</th>
                          <th style={{ padding: '10px', textAlign: 'center', color: '#F59E0B' }}>超時</th>
                          <th style={{ padding: '10px', textAlign: 'center', color: '#4F46E5' }}>正確率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gameTypeData.map((g, i) => {
                          const acc = g.正確 + g.錯誤 > 0 ? Math.round((g.正確 / (g.正確 + g.錯誤)) * 100) : 0;
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                              <td style={{ padding: '10px', fontWeight: '500' }}>{g.name}</td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>{g.場次}</td>
                              <td style={{ padding: '10px', textAlign: 'center', color: '#10B981', fontWeight: '600' }}>{g.正確}</td>
                              <td style={{ padding: '10px', textAlign: 'center', color: '#EF4444', fontWeight: '600' }}>{g.錯誤}</td>
                              <td style={{ padding: '10px', textAlign: 'center', color: '#F59E0B', fontWeight: '600' }}>{g.超時}</td>
                              <td style={{ padding: '10px', textAlign: 'center', color: '#4F46E5', fontWeight: '700' }}>{acc}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '40px' }}>尚無運動項目資料</p>
              )}
            </div>

            {/* ===== 完成度統計 ===== */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              {/* 場次完成度 */}
              <div style={chartCardStyle}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', marginBottom: '16px' }}>
                  場次完成度
                </h3>
                {completionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={completionData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {completionData.map((_, i) => (
                          <Cell key={i} fill={completionColors[i % completionColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '40px' }}>無資料</p>
                )}
              </div>

              {/* 動作分佈 */}
              <div style={chartCardStyle}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', marginBottom: '16px' }}>
                  動作結果分佈
                </h3>
                {actionPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={actionPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {actionPieData.map((_, i) => (
                          <Cell key={i} fill={actionColors[i % actionColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '40px' }}>無資料</p>
                )}
              </div>
            </div>

            {/* ===== 醫師評估備註 ===== */}
            <div style={chartCardStyle}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', marginBottom: '16px' }}>
                醫師評估備註
              </h3>
              <textarea
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                placeholder="請輸入對此病患的復健評估備註..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  fontSize: '15px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  onClick={saveDoctorNote}
                  disabled={noteSaving || !doctorNotes.trim()}
                  style={{
                    ...styles.button('primary'),
                    opacity: noteSaving || !doctorNotes.trim() ? 0.5 : 1,
                  }}
                >
                  {noteSaving ? '儲存中...' : '新增備註'}
                </button>
              </div>

              {/* 歷史備註 */}
              {noteHistory.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                    歷史備註
                  </h4>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {noteHistory.map((note, i) => (
                      <div
                        key={note.id || i}
                        style={{
                          padding: '12px 16px',
                          backgroundColor: '#F9FAFB',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          borderLeft: '3px solid #4F46E5',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#4F46E5' }}>
                            {note.doctor_name || '醫師'}
                          </span>
                          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                            {note.created_at ? new Date(note.created_at).toLocaleString('zh-TW') : ''}
                          </span>
                        </div>
                        <p style={{ fontSize: '14px', color: '#374151', margin: 0, whiteSpace: 'pre-wrap' }}>
                          {note.note}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={styles.dashboard}>
      {/* 導航列 */}
      <nav style={styles.navbar}>
        <div style={styles.navTitle}>積木復健系統 - 醫生端</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#6B7280' }}>
            歡迎，{doctorProfile?.full_name || user.email}醫師
          </span>
          <button onClick={onLogout} style={styles.logoutButton}>
            登出
          </button>
        </div>
      </nav>

      {/* 主要內容 */}
      <div style={styles.container}>
        {/* 選項卡 */}
        <div style={styles.tabs}>
          <button
            onClick={() => setCurrentView('patients')}
            style={styles.tab(currentView === 'patients' || currentView === 'editPatient')}
          >
            病患管理 ({patients.length})
          </button>
          <button
            onClick={() => {
              setCurrentView('records');
              if (selectedPatient) loadRehabData(selectedPatient);
            }}
            style={styles.tab(currentView === 'records')}
            disabled={!selectedPatient}
          >
            復健紀錄 {selectedPatient && `- ${selectedPatient.full_name}`}
          </button>
          <button
            onClick={() => setCurrentView('pairing')}
            style={styles.tab(currentView === 'pairing')}
            disabled={!selectedPatient}
          >
            遊戲配對 {selectedPatient && `- ${selectedPatient.full_name}`}
          </button>
        </div>

        {/* 內容區域 */}
        {currentView === 'patients' && renderPatientsList()}
        {currentView === 'editPatient' && renderEditForm()}
        {currentView === 'records' && renderRecords()}
        {currentView === 'pairing' && renderPairing()}
      </div>
    </div>
  );
};

export default DoctorDashboard;