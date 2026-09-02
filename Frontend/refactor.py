import re

with open('d:/RazorPay/Frontend/src/pages/DashboardPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update activeTab type
content = content.replace(
    "const [activeTab, setActiveTab] = useState<'insights' | 'setup' | 'protocol'>('insights');",
    "const [activeTab, setActiveTab] = useState<'insights' | 'setup' | 'protocol' | 'warehouse_sku'>('insights');"
)

# 2. Add Warehouse SKU tab
setup_tab_btn = """          <button
            onClick={() => setActiveTab('setup')}
            style={{
              padding: '0.65rem 1.25rem',
              background: activeTab === 'setup' ? '#ffffff' : 'transparent',
              border: activeTab === 'setup' ? '1px solid #111111' : 'none',
              borderBottom: activeTab === 'setup' ? '1px solid #ffffff' : 'none',
              marginBottom: '-1px',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              color: activeTab === 'setup' ? '#0044ff' : '#71717a',
              fontFamily: 'Space Grotesk',
              borderRadius: '2px 2px 0 0'
            }}
          >
            Merchant Configuration
          </button>"""
new_tab_btn = setup_tab_btn + """
          <button
            onClick={() => setActiveTab('warehouse_sku')}
            style={{
              padding: '0.65rem 1.25rem',
              background: activeTab === 'warehouse_sku' ? '#ffffff' : 'transparent',
              border: activeTab === 'warehouse_sku' ? '1px solid #111111' : 'none',
              borderBottom: activeTab === 'warehouse_sku' ? '1px solid #ffffff' : 'none',
              marginBottom: '-1px',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              color: activeTab === 'warehouse_sku' ? '#0044ff' : '#71717a',
              fontFamily: 'Space Grotesk',
              borderRadius: '2px 2px 0 0'
            }}
          >
            Warehouse SKU
          </button>"""

content = content.replace(setup_tab_btn, new_tab_btn)

# 3. Restructure the sections
product_catalogue_start = content.find('{/* Product Catalogue Management */}')
warehouse_inventory_end = content.find('            {/* Right Column (Profile, Warehouses & Delivery Zones) */}')

warehouse_locations_start = content.find('{/* Warehouse Locations */}')
delivery_zones_start = content.find('{/* Delivery zones */}')

profile_config_start = content.find('{/* Profile Config */}')

# Extract sections
product_and_inventory = content[product_catalogue_start:warehouse_inventory_end]
profile_config = content[profile_config_start:warehouse_locations_start]
warehouse_locations = content[warehouse_locations_start:delivery_zones_start]
delivery_zones = content[delivery_zones_start:content.find('            </div>\n\n          </div>\n        ) : null}')]

# Construct new setup tab content
new_setup_tab = f"""        ) : activeTab === 'setup' ? (
          <div style={{{{ display: 'grid', gridTemplateColumns: '1fr', gap: '0px', border: '1px solid #111111', borderRadius: '2px', background: '#ffffff' }}}}>
            {{/* Profile Config */}}
{profile_config}
            {{/* Delivery zones */}}
{delivery_zones}          </div>
        ) : activeTab === 'warehouse_sku' ? (
          <div style={{{{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '0px', border: '1px solid #111111', borderRadius: '2px', background: '#ffffff' }}}}>
            <div style={{{{ borderRight: '1px solid #111111', display: 'flex', flexDirection: 'column' }}}}>
              {product_and_inventory}            </div>
            <div style={{{{ background: '#faf9f6', display: 'flex', flexDirection: 'column' }}}}>
              {warehouse_locations}            </div>
          </div>
        ) : null}}
      </div>"""

# Replace the whole block
setup_tab_start = content.find(") : activeTab === 'setup' ? (")
setup_tab_end = content.find('        ) : null}\n      </div>') + len('        ) : null}\n      </div>')

content = content[:setup_tab_start] + new_setup_tab + content[setup_tab_end:]

with open('d:/RazorPay/Frontend/src/pages/DashboardPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
