import React, { useState, useEffect } from 'react';
import PatientGameConnectPage from './PatientGameConnectPage';
import RehabRecords from './RehabRecords';
import { supabase } from './supabaseClient';


const DoctorDashboard = ({ user, onLogout }) => {
  const [currentView, setCurrentView] = useState('patients'); // 'patients', 'records', 'editPatient', 'pairing'
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPatient, setEditingPatient] = useState(null);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [showDisabilityInfo, setShowDisabilityInfo] = useState(false);

  // 動作障礙等級說明
  const disabilityLevels = [
    { value: '0', label: '等級0', description: '沒有任何症狀' },
    { value: '1', label: '等級1', description: '有症狀但沒有明顯障礙並不影響日常生活及工作能力' },
    { value: '2', label: '等級2', description: '輕度障礙,會影響工作能力,但日常生活起居可以完全自理' },
    { value: '3', label: '等級3', description: '中度障礙,日常生活起居需要他人協助,但可以自行走動' },
    { value: '4', label: '等級4', description: '中重度障礙,日常生活起居和行走都需要他人協助' },
    { value: '5', label: '等級5', description: '重度障礙,臥床,大小便失禁,完全沒有生活自理能力,需要他人照護' }
  ];

  const loadDoctorProfile = async () => {
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
  };

  const loadPatients = async () => {
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
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadDoctorProfile(); loadPatients(); }, []);

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

  // 渲染復健紀錄
  const renderRecords = () => (
    <div>
      <RehabRecords patient={selectedPatient} doctorProfile={doctorProfile} />
      <button
        onClick={() => setCurrentView('patients')}
        style={{...styles.button('secondary'), marginTop: '16px'}}
      >
        返回病患列表
      </button>
    </div>
  );

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
            onClick={() => setCurrentView('records')}
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