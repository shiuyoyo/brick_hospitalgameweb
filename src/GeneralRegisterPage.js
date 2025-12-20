import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
const SUPABASE_URL = 'https://bxpooqjjozrtxbgbkymf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4cG9vcWpqb3pydHhiZ2JreW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNDQ2NDEsImV4cCI6MjA2ODkyMDY0MX0.yUlA7kSOx_02T9LUK3p3znl4BEiEAeqDUbJMuKvbFQ8';
// Supabase 客戶端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const GeneralRegisterPage = ({ onBack, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 表單狀態 - 只包含必要欄位
  const [formData, setFormData] = useState({
    idNumber: '',        // 身分證字號 (作為 username)
    surname: '',         // 姓名
    birthDate: '',       // 生日(8碼)
    age: '',             // 年齡
    gender: '',          // 性別
    assignedDoctor: ''   // 主治醫師 (從已註冊醫生中選擇)
  });

  // 已註冊的醫生列表
  const [doctors, setDoctors] = useState([]);

  // 載入已註冊的醫生
  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, full_name, surname')
        .eq('user_type', 'doctor')
        .eq('verification_status', 'verified'); // 只顯示已驗證的醫生

      if (error) {
        console.error('載入醫生列表錯誤:', error);
        // 如果查詢失敗，使用預設列表
        setDoctors([
          { id: 'default1', username: 'doc001', full_name: '張醫師', surname: '張醫師' },
          { id: 'default2', username: 'doc002', full_name: '李醫師', surname: '李醫師' },
          { id: 'default3', username: 'doc003', full_name: '王醫師', surname: '王醫師' },
          { id: 'default4', username: 'doc004', full_name: '陳醫師', surname: '陳醫師' },
          { id: 'default5', username: 'doc005', full_name: '林醫師', surname: '林醫師' }
        ]);
      } else {
        setDoctors(data || []);
        // 如果沒有醫生，添加一些預設選項
        if (!data || data.length === 0) {
          setDoctors([
            { id: 'default1', username: 'doc001', full_name: '張醫師', surname: '張醫師' },
            { id: 'default2', username: 'doc002', full_name: '李醫師', surname: '李醫師' },
            { id: 'default3', username: 'doc003', full_name: '王醫師', surname: '王醫師' }
          ]);
        }
      }
    } catch (err) {
      console.error('載入醫生列表異常:', err);
      setDoctors([
        { id: 'default1', username: 'doc001', full_name: '張醫師', surname: '張醫師' }
      ]);
    }
  };

  // CSS 樣式
  const styles = {
    background: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'linear-gradient(135deg, #FEF3C7 0%, #DBEAFE 100%)'
    },
    card: {
      width: '100%',
      maxWidth: '1000px',
      backgroundColor: 'white',
      borderRadius: '24px',
      padding: '40px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      position: 'relative'
    },
    backButton: {
      position: 'absolute',
      top: '20px',
      left: '20px',
      background: 'none',
      border: 'none',
      cursor: 'pointer'
    },
    userIcon: {
      position: 'absolute',
      top: '20px',
      right: '20px',
      width: '80px',
      height: '80px'
    },
    formContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      marginTop: '120px'
    },
    gridContainer: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '32px',
      width: '100%'
    },
    threeColumnGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: '24px',
      width: '100%'
    },
    label: {
      display: 'block',
      color: '#374151',
      fontWeight: '500',
      marginBottom: '8px',
      fontSize: '14px'
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      backgroundColor: '#F9FAFB',
      border: 'none',
      borderRadius: '8px',
      fontSize: '16px',
      outline: 'none',
      transition: 'all 0.2s',
      boxSizing: 'border-box'
    },
    select: {
      width: '100%',
      padding: '12px 16px',
      backgroundColor: '#F9FAFB',
      border: 'none',
      borderRadius: '8px',
      fontSize: '16px',
      outline: 'none',
      transition: 'all 0.2s',
      boxSizing: 'border-box',
      appearance: 'none',
      backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e")',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
      backgroundSize: '16px',
      paddingRight: '40px'
    },
    primaryButton: (disabled) => ({
      width: '100%',
      backgroundColor: disabled ? '#9CA3AF' : '#4F46E5',
      color: 'white',
      padding: '16px',
      borderRadius: '16px',
      fontWeight: '500',
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background-color 0.2s',
      fontSize: '16px'
    }),
    errorMessage: {
      marginTop: '16px',
      padding: '12px',
      backgroundColor: '#FEF2F2',
      border: '1px solid #FECACA',
      borderRadius: '8px',
      color: '#B91C1C',
      fontSize: '14px',
      textAlign: 'center'
    },
    successMessage: {
      marginTop: '16px',
      padding: '12px',
      backgroundColor: '#F0FDF4',
      border: '1px solid #BBF7D0',
      borderRadius: '8px',
      color: '#166534',
      fontSize: '14px',
      textAlign: 'center'
    }
  };

  // 處理輸入變更
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 根據生日計算年齡
  const calculateAge = (birthDate) => {
    if (birthDate.length === 8) {
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
    }
    return '';
  };

  // 當生日改變時自動計算年齡
  const handleBirthDateChange = (value) => {
    handleInputChange('birthDate', value);
    const age = calculateAge(value);
    if (age) {
      handleInputChange('age', age.toString());
    }
  };

  // 處理一般用戶註冊
  const handleRegister = async () => {
    // 表單驗證
    if (!formData.idNumber || !formData.surname || !formData.birthDate || 
        !formData.age || !formData.gender || !formData.assignedDoctor) {
      setMessage('請填寫所有欄位');
      return;
    }

    // 身分證字號格式驗證
    if (formData.idNumber.length !== 10) {
      setMessage('身分證字號應為10碼');
      return;
    }

    // 生日格式驗證
    if (!/^\d{8}$/.test(formData.birthDate)) {
      setMessage('生日格式應為8碼數字 (例: 19900101)');
      return;
    }

    // 年齡驗證
    const age = parseInt(formData.age);
    if (isNaN(age) || age < 0 || age > 150) {
      setMessage('請輸入有效的年齡');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      console.log('開始一般用戶註冊:', formData.idNumber);
      console.log('選擇的醫生:', formData.assignedDoctor);

      // 檢查身分證字號是否已被註冊
      const { data: existingUsers, error: checkError } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('username', formData.idNumber);

      if (checkError) {
        console.error('檢查身分證字號錯誤:', checkError);
        setMessage('系統錯誤，請稍後再試');
        setLoading(false);
        return;
      }

      if (existingUsers && existingUsers.length > 0) {
        setMessage('此身分證字號已被註冊');
        setLoading(false);
        return;
      }

      // 生成臨時 email（用於滿足資料庫 email 不能為空的需求）
      const tempEmail = `${formData.idNumber}@temp.patient.local`;
      
      // 一般用戶密碼：身分證後六碼
      const patientPassword = formData.idNumber.slice(-6);

      // 直接插入 user_profiles 表 - 包含 assigned_doctor
      const { data, error } = await supabase
        .from('user_profiles')
        .insert([
          {
            user_type: 'general',
            username: formData.idNumber,
            full_name: formData.surname,
            surname: formData.surname,
            email: tempEmail,
            assigned_doctor: formData.assignedDoctor,  // 重要：加入選擇的醫生
            verification_status: 'verified' // 一般用戶直接設為已驗證
          }
        ])
        .select();

      console.log('插入資料:', {
        user_type: 'general',
        username: formData.idNumber,
        full_name: formData.surname,
        surname: formData.surname,
        email: tempEmail,
        assigned_doctor: formData.assignedDoctor,  // 確認有包含醫生
        verification_status: 'verified'
      });

      if (error) {
        console.error('一般用戶註冊錯誤:', error);
        setMessage(`註冊失敗: ${error.message}`);
      } else if (data && data.length > 0) {
        console.log('一般用戶註冊成功:', data[0]);
        
        // 插入健康記錄
        const { error: healthError } = await supabase
          .from('user_health_records')
          .insert([
            {
              user_id: data[0].user_id || null,  // 可能為 null
              age: parseInt(formData.age),
              gender: formData.gender,
              birth_date: formData.birthDate  // 如果資料庫有這個欄位
            }
          ]);

        if (healthError) {
          console.error('插入健康記錄錯誤:', healthError);
          // 不阻止註冊流程，只記錄錯誤
        }

        setMessage(`註冊成功！您的帳號是：${formData.idNumber}，密碼是身分證後六碼：${patientPassword}`);
        
        // 清空表單
        setFormData({
          idNumber: '',
          surname: '',
          birthDate: '',
          age: '',
          gender: '',
          assignedDoctor: ''
        });

        // 3 秒後執行成功回調
        setTimeout(() => {
          if (onSuccess) {
            onSuccess(data[0], tempEmail);
          }
        }, 3000);
      } else {
        setMessage('註冊失敗：未知錯誤');
      }
    } catch (err) {
      console.error('一般用戶註冊異常:', err);
      setMessage(`註冊異常: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.background}>
      <div style={styles.card}>
        {/* 返回按鈕 */}
        <button
          onClick={onBack}
          style={styles.backButton}
        >
          <img src="ic_arrow.png" alt="返回" style={{width: '24px', height: '24px'}} />
        </button>

        {/* 使用者圖示 */}
        <div style={styles.userIcon}>
          <img src="ic_user.png" alt="使用者圖示" style={{width: '100%', height: '100%'}} />
        </div>

        {/* 一般用戶註冊表單 */}
        <div style={styles.formContainer}>
          {/* 第一行：身分證字號和姓名 */}
          <div style={styles.gridContainer}>
            <div>
              <label style={styles.label}>身分證字號</label>
              <input
                type="text"
                value={formData.idNumber}
                onChange={(e) => handleInputChange('idNumber', e.target.value.toUpperCase())}
                placeholder="A123456789"
                style={styles.input}
                maxLength={10}
              />
            </div>
            <div>
              <label style={styles.label}>姓名</label>
              <input
                type="text"
                value={formData.surname}
                onChange={(e) => handleInputChange('surname', e.target.value)}
                placeholder="王小明"
                style={styles.input}
              />
            </div>
          </div>

          {/* 第二行：生日和年齡 */}
          <div style={styles.gridContainer}>
            <div>
              <label style={styles.label}>生日(8碼)</label>
              <input
                type="text"
                value={formData.birthDate}
                onChange={(e) => handleBirthDateChange(e.target.value)}
                placeholder="19900101"
                style={styles.input}
                maxLength={8}
                pattern="\d{8}"
              />
            </div>
            <div>
              <label style={styles.label}>年齡</label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => handleInputChange('age', e.target.value)}
                placeholder="30"
                style={styles.input}
                min="0"
                max="150"
              />
            </div>
          </div>

          {/* 第三行：性別和主治醫師 */}
          <div style={styles.gridContainer}>
            <div>
              <label style={styles.label}>性別</label>
              <select
                value={formData.gender}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                style={styles.select}
              >
                <option value="">選擇性別</option>
                <option value="男">男</option>
                <option value="女">女</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>主治醫師</label>
              <select
                value={formData.assignedDoctor}
                onChange={(e) => handleInputChange('assignedDoctor', e.target.value)}
                style={styles.select}
              >
                <option value="">選擇主治醫師</option>
                {doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.username}>
                    {doctor.full_name || doctor.surname} ({doctor.username})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 註冊按鈕 */}
          <button
            onClick={handleRegister}
            disabled={loading}
            style={styles.primaryButton(loading)}
          >
            {loading ? '建立中...' : '建立帳號'}
          </button>
        </div>

        {/* 訊息顯示 */}
        {message && (
          <div style={message.includes('成功') ? styles.successMessage : styles.errorMessage}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default GeneralRegisterPage;