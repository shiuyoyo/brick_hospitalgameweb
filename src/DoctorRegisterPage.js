import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
const SUPABASE_URL = 'https://bxpooqjjozrtxbgbkymf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4cG9vcWpqb3pydHhiZ2JreW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNDQ2NDEsImV4cCI6MjA2ODkyMDY0MX0.yUlA7kSOx_02T9LUK3p3znl4BEiEAeqDUbJMuKvbFQ8';

// Supabase 客戶端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DoctorRegisterPage = ({ onBack, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 表單狀態 - 醫生專用欄位（包含 hospital_name）
  const [formData, setFormData] = useState({
    username: '',      // 使用者名稱
    surname: '',       // 姓名
    password: '',      // 輸入密碼
    email: '',         // E-mail
    hospitalName: ''   // 醫院名稱（必填）
  });

  // CSS 樣式 - 調整為與登入頁面相同大小
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
      marginTop: '120px' // 為了避開右上角的圖示
    },
    wideGridContainer: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '32px', // 增加間距
      width: '100%'
    },
    fullWidthContainer: {
      display: 'grid',
      gridTemplateColumns: '1fr',
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

  // 處理醫生註冊
  const handleRegister = async () => {
    // 表單驗證 - 醫生需要這5個欄位
    if (!formData.username || !formData.surname || !formData.password || 
        !formData.email || !formData.hospitalName) {
      setMessage('請填寫所有欄位');
      return;
    }

    // 簡單的 email 格式驗證
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setMessage('請輸入有效的 Email 地址');
      return;
    }

    // 密碼長度驗證
    if (formData.password.length < 6) {
      setMessage('密碼至少需要 6 個字符');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      console.log('開始醫生註冊:', formData.email);

      // 首先檢查使用者名稱是否已存在
      const { data: existingUsers, error: checkError } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('username', formData.username);

      if (checkError) {
        console.error('檢查使用者名稱錯誤:', checkError);
        setMessage('系統錯誤，請稍後再試');
        setLoading(false);
        return;
      }

      if (existingUsers && existingUsers.length > 0) {
        setMessage('此使用者名稱已有人使用，請換一個');
        setLoading(false);
        return;
      }

      // 檢查 Email 是否已存在
      const { data: existingEmails, error: emailCheckError } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('email', formData.email);

      if (emailCheckError) {
        console.error('檢查 Email 錯誤:', emailCheckError);
        setMessage('系統錯誤，請稍後再試');
        setLoading(false);
        return;
      }

      if (existingEmails && existingEmails.length > 0) {
        setMessage('此 Email 已被註冊，請使用其他 Email');
        setLoading(false);
        return;
      }

      // 使用 Supabase Auth 註冊醫生用戶
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            username: formData.username,
            surname: formData.surname,
            full_name: formData.surname,
            hospital_name: formData.hospitalName,
            user_type: 'doctor' // 標記為醫生
          }
        }
      });

      console.log('Supabase 醫生註冊回應:', { data, error });

      if (error) {
        console.error('醫生註冊錯誤:', error);
        if (error.message.includes('User already registered')) {
          setMessage('此 Email 已被註冊，請使用其他 Email');
        } else {
          setMessage(`註冊失敗: ${error.message}`);
        }
      } else if (data.user) {
        console.log('醫生註冊成功:', data.user);
        
        // 等待一下讓 Auth 觸發器完成，然後更新 user_profiles
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 查詢是否已經有自動創建的 profile 記錄
        const { data: existingProfile, error: queryError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .single();
          
        console.log('查詢現有 profile:', { existingProfile, queryError });
        
        if (existingProfile) {
          // 如果已有記錄，更新它
          console.log('更新現有 profile 記錄');
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({
              user_type: 'doctor',  // 強制更新為 doctor
              username: formData.username,
              full_name: formData.surname,
              surname: formData.surname,
              hospital_name: formData.hospitalName,
              verification_status: 'pending'
            })
            .eq('user_id', data.user.id);
            
          if (updateError) {
            console.error('更新用戶資料錯誤:', updateError);
          } else {
            console.log('成功更新 user_type 為 doctor');
          }
        } else {
          // 如果沒有記錄，插入新的
          console.log('插入新的 profile 記錄');
          const { error: insertError } = await supabase
            .from('user_profiles')
            .insert([
              {
                user_id: data.user.id,
                user_type: 'doctor',
                username: formData.username,
                full_name: formData.surname,
                surname: formData.surname,
                email: formData.email,
                hospital_name: formData.hospitalName,
                verification_status: 'pending'
              }
            ]);
            
          if (insertError) {
            console.error('插入用戶資料錯誤:', insertError);
          }
        }

        setMessage(`註冊成功！您的使用者名稱是：${formData.username}。帳號需要管理員驗證後才能使用。`);
        
        // 清空表單
        setFormData({
          username: '',
          surname: '',
          password: '',
          email: '',
          hospitalName: ''
        });

        // 3 秒後執行成功回調
        setTimeout(() => {
          if (onSuccess) {
            onSuccess(data.user, formData.email);
          }
        }, 3000);
      } else {
        setMessage('註冊失敗：未知錯誤');
      }
    } catch (err) {
      console.error('醫生註冊異常:', err);
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

        {/* 醫生圖示 - 右上角 */}
        <div style={styles.userIcon}>
          <img src="ic_doctor.png" alt="醫生圖示" style={{width: '100%', height: '100%'}} />
        </div>

        {/* 醫生註冊表單 */}
        <div style={styles.formContainer}>
          {/* 第一行：使用者名稱和姓名 */}
          <div style={styles.wideGridContainer}>
            <div>
              <label style={styles.label}>使用者名稱</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="dr_wang"
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>姓名</label>
              <input
                type="text"
                value={formData.surname}
                onChange={(e) => handleInputChange('surname', e.target.value)}
                placeholder="王醫師"
                style={styles.input}
              />
            </div>
          </div>

          {/* 第二行：密碼和 Email */}
          <div style={styles.wideGridContainer}>
            <div>
              <label style={styles.label}>輸入密碼</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="至少6個字符"
                style={styles.input}
                minLength={6}
              />
            </div>
            <div>
              <label style={styles.label}>E-mail</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="doctor@hospital.com"
                style={styles.input}
              />
            </div>
          </div>

          {/* 第三行：醫院名稱（全寬） */}
          <div style={styles.fullWidthContainer}>
            <div>
              <label style={styles.label}>醫院名稱 *</label>
              <input
                type="text"
                value={formData.hospitalName}
                onChange={(e) => handleInputChange('hospitalName', e.target.value)}
                placeholder="台大醫院"
                style={styles.input}
              />
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

export default DoctorRegisterPage;