import React, { useState } from 'react';

const SupabaseSchemaInspector = () => {
  const [schemaData, setSchemaData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Supabase Configuration - 使用您的實際憑證
  const SUPABASE_URL = 'https://bxpooqjjozrtxbgbkymf.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4cG9vcWpqb3pydHhiZ2JreW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNDQ2NDEsImV4cCI6MjA2ODkyMDY0MX0.yUlA7kSOx_02T9LUK3p3znl4BEiEAeqDUbJMuKvbFQ8';

  const fetchDatabaseSchema = async () => {
    setLoading(true);
    setError(null);
    setSchemaData(null);

    try {
      console.log('開始檢查資料庫結構...');

      // 使用 REST API 來查詢 information_schema
      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      // 1. 獲取所有 tables
      console.log('正在獲取所有 tables...');
      const tablesResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/get_schema_tables`, 
        {
          method: 'POST',
          headers,
          body: JSON.stringify({})
        }
      );

      let tables = [];
      if (!tablesResponse.ok) {
        // 如果 RPC 不存在，使用替代方法
        console.log('使用替代方法獲取 tables...');
        
        // 嘗試直接查詢一些常見的 table 名稱
        const commonTables = [
          'user_profiles', 
          'users', 
          'doctors', 
          'patients', 
          'appointments',
          'medical_records',
          'auth.users'
        ];

        const tablePromises = commonTables.map(async (tableName) => {
          try {
            const response = await fetch(
              `${SUPABASE_URL}/rest/v1/${tableName}?limit=0`, 
              { headers }
            );
            if (response.ok) {
              return { table_name: tableName, exists: true };
            }
            return null;
          } catch (e) {
            return null;
          }
        });

        const results = await Promise.all(tablePromises);
        tables = results.filter(result => result !== null);
      } else {
        const tablesData = await tablesResponse.json();
        tables = tablesData;
      }

      console.log('找到的 tables:', tables);

      // 2. 對於每個 table，獲取欄位資訊
      const schemaInfo = {};
      
      for (const table of tables) {
        const tableName = table.table_name;
        console.log(`正在檢查 table: ${tableName}`);
        
        try {
          // 嘗試獲取 table 的第一筆資料來了解結構
          const dataResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/${tableName}?limit=1`, 
            { headers }
          );

          if (dataResponse.ok) {
            const data = await dataResponse.json();
            
            // 從回應 headers 中獲取欄位資訊
            const contentRange = dataResponse.headers.get('Content-Range');
            
            schemaInfo[tableName] = {
              exists: true,
              sample_data: data,
              columns: data.length > 0 ? Object.keys(data[0]) : [],
              row_count_info: contentRange
            };

            // 如果有資料，分析欄位類型
            if (data.length > 0) {
              const columnTypes = {};
              const firstRow = data[0];
              
              Object.keys(firstRow).forEach(column => {
                const value = firstRow[column];
                if (value === null) {
                  columnTypes[column] = 'null';
                } else if (typeof value === 'string') {
                  // 檢查是否為日期格式
                  if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
                    columnTypes[column] = 'date/timestamp';
                  } else {
                    columnTypes[column] = 'text';
                  }
                } else if (typeof value === 'number') {
                  columnTypes[column] = Number.isInteger(value) ? 'integer' : 'numeric';
                } else if (typeof value === 'boolean') {
                  columnTypes[column] = 'boolean';
                } else {
                  columnTypes[column] = typeof value;
                }
              });
              
              schemaInfo[tableName].column_types = columnTypes;
            }
          } else {
            console.log(`無法訪問 table: ${tableName}`);
            schemaInfo[tableName] = {
              exists: false,
              error: `HTTP ${dataResponse.status}: ${dataResponse.statusText}`
            };
          }
        } catch (tableError) {
          console.error(`檢查 table ${tableName} 時發生錯誤:`, tableError);
          schemaInfo[tableName] = {
            exists: false,
            error: tableError.message
          };
        }
      }

      // 3. 嘗試獲取一些系統資訊
      try {
        console.log('正在獲取系統資訊...');
        
        // 嘗試查詢 auth.users (如果可以的話)
        const authResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/auth.users?limit=1`, 
          { headers }
        );
        
        if (authResponse.ok) {
          const authData = await authResponse.json();
          schemaInfo['auth.users'] = {
            exists: true,
            sample_data: authData,
            columns: authData.length > 0 ? Object.keys(authData[0]) : [],
            note: '系統認證表'
          };
        }
      } catch (authError) {
        console.log('無法獲取 auth.users 資訊:', authError.message);
      }

      setSchemaData(schemaInfo);
      console.log('完整的資料庫結構:', schemaInfo);

    } catch (err) {
      console.error('獲取資料庫結構時發生錯誤:', err);
      setError(`錯誤: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const exportSchemaData = () => {
    if (schemaData) {
      const dataStr = JSON.stringify(schemaData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'supabase-schema.json';
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const copyToClipboard = () => {
    if (schemaData) {
      const dataStr = JSON.stringify(schemaData, null, 2);
      navigator.clipboard.writeText(dataStr).then(() => {
        alert('資料已複製到剪貼簿！');
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Supabase 資料庫結構檢查器
        </h1>
        <p className="text-gray-600">
          這個工具可以幫助檢查您的 Supabase 資料庫中的所有 table 和欄位結構
        </p>
      </div>

      <div className="mb-6">
        <button
          onClick={fetchDatabaseSchema}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          {loading ? '檢查中...' : '開始檢查資料庫結構'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-800 font-medium mb-2">錯誤訊息</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {schemaData && (
        <div className="space-y-6">
          <div className="flex gap-4 mb-4">
            <button
              onClick={copyToClipboard}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium"
            >
              複製到剪貼簿
            </button>
            <button
              onClick={exportSchemaData}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-medium"
            >
              下載 JSON 檔案
            </button>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-xl font-bold mb-4">發現的 Tables ({Object.keys(schemaData).length})</h2>
            
            {Object.entries(schemaData).map(([tableName, tableInfo]) => (
              <div key={tableName} className="mb-6 p-4 bg-white rounded border">
                <h3 className="text-lg font-semibold text-blue-600 mb-2">
                  📋 {tableName}
                </h3>
                
                {tableInfo.exists ? (
                  <div className="space-y-3">
                    <div>
                      <strong className="text-green-600">✅ 可以訪問</strong>
                      {tableInfo.note && (
                        <span className="ml-2 text-sm text-gray-500">({tableInfo.note})</span>
                      )}
                    </div>
                    
                    {tableInfo.columns && tableInfo.columns.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">欄位 ({tableInfo.columns.length}):</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {tableInfo.columns.map(column => (
                            <div key={column} className="bg-blue-50 px-2 py-1 rounded text-sm">
                              <span className="font-mono text-blue-800">{column}</span>
                              {tableInfo.column_types && tableInfo.column_types[column] && (
                                <span className="text-gray-500 text-xs ml-1">
                                  ({tableInfo.column_types[column]})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {tableInfo.sample_data && tableInfo.sample_data.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">範例資料:</h4>
                        <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                          {JSON.stringify(tableInfo.sample_data[0], null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {tableInfo.row_count_info && (
                      <div className="text-sm text-gray-600">
                        資料量資訊: {tableInfo.row_count_info}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-red-600">
                    ❌ 無法訪問: {tableInfo.error}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h3 className="font-medium text-yellow-800 mb-2">📋 完整 JSON 資料</h3>
            <pre className="bg-white p-4 rounded border text-xs overflow-x-auto max-h-96">
              {JSON.stringify(schemaData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">正在檢查資料庫結構...</p>
        </div>
      )}
    </div>
  );
};

export default SupabaseSchemaInspector;