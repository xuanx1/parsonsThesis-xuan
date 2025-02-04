# "Enduring Networks in Southeast Asia: A Data-Driven Approach to Rail Line and Station Placement Using Combinatorial Optimization"

## Abstract
![20241012_ASP502](https://github.com/user-attachments/assets/cdaa2dc4-d57e-4b52-9a3b-9ee315577f20)
###### Source: https://www.economist.com/asia/2024/10/10/new-railways-could-transform-south-east-asia

Enduring Networks in an Unforgiving Climate.

Prior to commencing the construction of a rail network, feasibility studies are conducted. These studies include terrain analysis, identifying surrounding population clusters, and even weather conditions. A significant amount of investments, resources, and labur are dedicated to this rigorous pre-selection process. 

Given the unique weather conditions native to Southeast Asia and the political risks associated with large infrastructure projects, incorporating a data-driven tool into the pre-selection process can enhance transparency, reduce susceptibility to corruption, and ensure more efficient, resilient, and well-planned railway development.

This project aims to develop a data visualization tool that assists in planning public transport lines and station placements specific to Southeast Asia. The project leverages data such as ground elevation, movement patterns, population density, and existing infrastructure to propose the most efficient rail network from Point A to Point B. 

LINK TO PROJECT

## Table of Contents
1. [Introduction](#1introduction)
   - [1.1  Costs of Infrastructure Projects in Southeast Asia Context](#11-costs-of-infrastructure-projects-in-the-southeast-asian-context)
   - [1.2 Project Scope](#12-lorem)
   - [1.3 Contextualization with Existing Frameworks](#12-lorem)
   - [1.4 Contextualization with Existing Methodologies](#12-lorem)

2. [Treatment](#2treatment)
   - [2.1 Data Types and Collection](#21-Data-Types-and-Collection)  
   - [2.2 Preprocessing]
      - [2.2.1 Standardization and Normalization]
   - [2.3 Combinatorial Optimization]
   - [2.4 Setting Requirements]
      - [2.4.1 Requirements for Construction Criteria]
         - [2.4.2 Criteria Matrix]
   - [2.5 Translate Criteria Matrix to Conditions]
      - [2.5.1 Terrain Data]
         - [2.5.1.1 Ground Elevation - flooding]
         - [2.5.1.2 Earthquake Safety Distance]
         - [2.5.1.3 Minimal Deforestation]
         - [2.5.1.4 Distance from Coasts]
         - [2.5.1.5 Tsunami Risk Index]
         - [2.5.1.6 Humidity Index]
         - [2.5.1.7 Proximity Risk Index – Disaster vs Population vs Forest]
      - [2.5.2 Census Data]
         - [2.5.2.1 Population Density]
         - [2.5.2.2 GDP Per Capita]
      - [2.5.3 Miscellaneous]
         - [2.5.3.1 Existing Network Lines]
   - [2.6 Visualization and Interpretation]
      - [2.6.1 Interaction]
      - [2.6.2 Settings]

3. [Results and Findings](#3results-and-findings)
   
4. [Conclusion](#4conclusion)
   - [4.1 Final Statement](#31-lorem-ipsum)
   - [4.2 Benefits to Southeast Asia](#32-lorem)
   - [4.3 Disadvantages of Technique to Southeast Asia](#32-lorem)
   - [4.4 Further Areas of Interest / Consideration](#32-lorem)
     
5. [Literature Review](#5literature-review)
   - [5.1 Books](#51-books)  
   - [5.2 Articles](#52-articles)
 
## 1.Introduction
#### 1.1  Costs of Infrastructure Projects in the Southeast Asian Context
Historically, Southeast Asia has struggled to develop cohesive transport networks due to natural barriers, political fragmentation, and economic disparities, which has contributed to poor urban planning and underutilized transport routes. Such pan-regional infrastructure generally requires a substantial amount of funding, time and resources. 

The region’s terrain, ranging from rainforests to river deltas along with its weather, characterized by monsoon seasons and high humidity—introduces new challenges to the durability and maintenance of existing infrastructure as deterioration through flooding and high humidity, has led to a necessity for frequent maintenance work and in return, their associated costs.

This project aligns with the agenda of the ASEAN Economic Community (AEC), which seeks to promote regional integration and economic development through improved infrastructure. However, the AEC’s vision is often undermined by Southeast Asia’s vulnerability to extreme weather events, a challenge that is expected to intensify with climate change. 

By integrating climate resilience into transport planning through data-driven optimization, this project provides a strategic approach to mitigating these risks while advancing sustainable regional connectivity.


#### 1.2 Project Scope
This project, inspired by the rapid urbanization and infrastructure challenges in Southeast Asia, where uneven development has led to economic disparities and access to resources, aims to develop a data visualization-based calculator that assists in planning public transport lines and station placements in Southeast Asia. 

The calculator uses combinatorial optimization to propose the most sensible curvature of a rail network to be constructed, reducing the resources allocated to their planning phases so they can be better used for other aspects of the project. This helps to decrease the workload in planning and place more emphasis on its construction, translating to the eventual ease of movement for human capital, services, and resources, thereby facilitating economic integration.


#### 1.3 Contextualization with Existing Frameworks
| **Framework**                                                                 | **Objectives**                                                                                                                                                                                                 | **Scope**                                                                                     | **Geographic Focus**                     | **Key Features**                                                                                                                                                                                                 | **Planning Methods**                                                                                                                                                                                                                   |
|-------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|-------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **African Continental Free Trade Area (AfCFTA) Transport Infrastructure Development** | Promote intra-African trade by improving transport infrastructure and connectivity.                                                                                                                          | Road, rail, air, and maritime transport networks.                                             | Africa                                    | Focuses on reducing trade barriers, enhancing cross-border transport, and integrating regional markets.                                                                                                         | - **GIS-based spatial analysis**<br>- **Cost-benefit analysis**<br>- **Multi-criteria decision-making (MCDM)**                                                                                                                        |
| **ASEAN Connectivity Master Plan (ACMP)**                                     | Enhance physical, institutional, and people-to-people connectivity within ASEAN Southeast Asia.                                                                                                                             | Transport, energy, ICT, and digital infrastructure.                                           | Southeast Asia (ASEAN member states)     | Aims to create a seamless regional network to support economic growth and integration.                                                                                                                          | - **GIS for corridor mapping**<br>- **Network optimization models**<br>- **Scenario planning**                                                                                                                                        |
| **Belt and Road Initiative (BRI)**                                            | Strengthen global trade and infrastructure networks through massive infrastructure investments.                                                                                                              | Roads, railways, ports, energy, and telecommunications.                                       | Global (primarily Asia, Europe, Africa)  | A China-led initiative focusing on building trade corridors and fostering economic cooperation.                                                                                                                 | - **Combinatorial optimization** for route planning<br>- **GIS for spatial analysis**                                                                                                                    |
| **NAFTA / USMCA Transport Corridors**                                         | Facilitate trade and transport efficiency among the U.S., Mexico, and Canada.                                                                                                                                | Road, rail, and maritime transport corridors.                                                 | North America                             | Focuses on streamlining cross-border trade and improving infrastructure to support supply chains.                                                                                                               | - **Traffic flow modeling**<br>- **GIS for corridor analysis**<br>- **Simulation-based optimization**                                                                                                                                 |
| **Pacific Alliance Infrastructure Integration Initiative**                    | Strengthen economic integration and infrastructure connectivity among member countries.                                                                                                                      | Transport, energy, and telecommunications.                                                   | Latin America (Chile, Colombia, Mexico, Peru) | Aims to create a unified market and improve regional infrastructure to boost trade and investment.                                                                                                              | - **GIS for spatial planning**<br>- **Economic impact analysis**<br>- **Network optimization**                                                                                                                                        |
| **SAARC Regional Multimodal Transport Study**                                 | Develop a regional multimodal transport system to enhance connectivity and trade.                                                                                                                            | Road, rail, air, and maritime transport.                                                      | South Asia (SAARC member states)          | Focuses on improving cross-border transport links and reducing transit costs.                                                                                                                                   | - **GIS for corridor identification**<br>- **Multi-modal network optimization**<br>- **Cost-effectiveness analysis**                                                                                                                  |
| **Trans-European Transport Network (TEN-T)**                                 | Create a seamless and efficient transport network across the EU.                                                                                                                                             | Road, rail, air, and maritime transport, as well as logistics hubs.                           | Europe (EU member states)                 | Aims to connect major European cities and regions, reduce travel times, and promote sustainable transport.                                                                                                      | - **Combinatorial optimization** for network design<br>- **GIS for spatial planning**<br>- **Traffic simulation models**<br>- **Lifecycle cost analysis**                                                                             |


#### 1.4 Contextualization with Existing Methodologies
• **Combinatorial Optimization, subset of Network Optimization Models and Urban Network Analysis (UNA)**: A mathematical approach used to find the most efficient or optimal solution from a finite set of possible options.

• **Geographic Information Systems (GIS)**: A tool for spatial analysis and visualization to make informed decisions about infrastructure development.

• **Multi-Criteria Decision-Making (MCDM)**:  Maps levels of priority for projects based on multiple factors like cost, environmental impact, social benefits, and technical feasibility.

• **Traffic Flow Modeling and Simulation**: Used to predict and optimize traffic and logistics in transport corridors by simulating different scenarios.

• **Climate-Resilient Infrastructure Frameworks**: Extra considerations placed on designing and building infrastructure that can withstand the impacts of extreme weather.
   

## 2.Treatment
#### 2.1 Data Types and Collection
Potential Sources of Relevant Data:

•	Terrain Elevation: Digital elevation models, DEMs/ Lidar to identify geographical barriers, and minimum heights to avoid floods; https://opentopography.org/

•	Distance from Coastline: Proximity distance from the coastline to avoid floods and to connect ports to heart of cities. https://www.openstreetmap.org/

•	Human Movement: Transport company / open govt portals to understand patterns(micro) and migration trends(macro).

•	Population Density and Economic Activity: Census data and economic data to identify high-demand areas. https://human-settlement.emergency.copernicus.eu/ / https://data.worldbank.org/ / https://www.oecd.org/en/data.html / https://data.adb.org/

•	Existing Infrastructure: Point/Line shapefiles on roads, railways, and ports to avoid redundancy and integrate with existing networks. https://data.opendatasoft.com/pages/home/


#### 2.2 Preprocessing
lorem
   ##### 2.2.1 Standardization and Normalization into an Index

#### 2.3 Combinatorial Optimization Function
lorem

#### 2.4 Setting Requirements - add source
lorem

   ##### 2.4.1 Requirements for Construction Criteria
   lorem
   
   ##### 2.4.2 Criteria Matrix
   lorem

#### 2.5 Translate Requirements to Conditions
lorem

   ##### 2.5.1 Terrain Data
   lorem
   
      ##### 2.5.1.1 Ground Elevation - flooding
      lorem
   
      ##### 2.5.1.2 Earthquake Safety Distance
      lorem

      ##### 2.5.1.3 Minimal Deforestation
      lorem

      ##### 2.5.1.4 Distance from Coasts
      lorem

      ##### 2.5.1.5 Tsunami Risk Index
      lorem

      ##### 2.5.1.6 Humidity Index
      lorem
      
      ##### 2.5.1.7 Proximity Risk Index – Disaster vs Population vs Forest
      lorem
   
   ##### 2.5.2 Census Data
   lorem
   
      ##### 2.5.2.1 Population Density
      lorem
   
      ##### 2.5.2.2 GDP Per Capita
      lorem

   ##### 2.5.3 Miscellaneous
   lorem
   
      ##### 2.5.3.1 Existing Network Lines
      lorem
   
#### 2.6 Visualization and Interpretation
lorem

   ##### 2.6.1 Interaction
   lorem
   
   ##### 2.6.2 Settings
   lorem

## 3.Results and Findings

## 4.Conclusion
#### 4.1 Final Statement
lorem

#### 4.2 Benefits to Southeast Asia

• **Economic Integration**: A meticulously planned network helps to facilitate the ease of movement of goods, services, and human capital, promoting trade and economic development.

• **Encouraging Equality**: By linking rural and urban communities, inequities are lessened, and better access to employment opportunities—which are typically limited to highly urbanized areas.
	
• **Weather Resilience**: With infrastructure built with numerous considerations specific to Southeast Asia, this reduces the likelihood of a frequent need for costly maintenance and repairs caused by the regional weather conditions.

• **Sustainable Development**: The tool promotes sustainable transport solutions by minimizing construction efforts and integrating with existing infrastructure.
   
• **Policy Support**: The project provides actionable insights for policymakers and urban planners, with evidence-based decision-making. 


#### 4.3 Disadvantages of Such Technique

• **Data Quality and Availability**: The efficacy of the results depends heavily on the quality of the input. As the practice of maintaining OpenData is still in its infancy in many Southeast Asian countries, this will lead to incomplete or inconsistent datasets, causing suboptimal decisions.

• **Over-Reliant on Quantitative Data**: Because the tool relies heavily on quantitative data, it will not adequately capture qualitative elements like the cultural value of different places.

• **Scalability Issues**: The tool may not function well when applied to other unfamiliar areas, due to low availability/quality of data. 


#### 4.4 Further Areas of Interest / Consideration

• **Environmental Impact**: Incorporate forested areas to give the tool an additional layer of environmental consideration so that deforestation is kept to the minimum while paving the way for construction.

• **Political and Social Factors**: Account for administrative and political border boundaries so that there are considerations for autonomous government and culturally sensitive areas.

• **Real-Time Data Integration**: Integrate real-time data (via api calls) to update the construction criteria without manually updating the data sets.

• **Using Reinforcement Learning**: Explore possibilities of incorporating a sense of continuity to the process, which ensures auxiliary proposed networks can be conceptualised on current proposal and still be both efficient and connected.


## 5.Literature Review
#### 5.1 Books

Graham, Stephen. Disrupted cities: When infrastructure fails. New York, NY: Routledge, 2010. 

Jones, Gavin W., and Pravin Visaria. Urbanization in large developing countries: China, Indonesia, Brazil, and India. Oxford: Clarendon Press, 2023. 

Zembri-Mary, Geneviève. Project risks: Actions around uncertainty in urban planning and infrastructure development. London, UK, Hoboken, NJ: ISTE, Ltd. ; Wiley, 2019. 

Boarnet, Marlon Gary. Transportation Infrastructure: The challenges of rebuilding america. Chicago: American Planning Association, 2009. 

Mitra, Saptarshi, Sumana Bandyopadhyay, Stabak Roy, and Tomaz Ponce Dentinho. Railway Transportation in South Asia: Infrastructure Planning, Regional Development and economic impacts. Cham, Cham: Springer International Publishing Springer, 2021. 

Etingoff, Kim. Sustainable Cities Urban Planning Challenges and policy. Toronto: Apple Academic Press, 2021. 


#### 5.2 Articles
Fünfgeld, Anna. “The Dream of ASEAN Connectivity: Imagining Infrastructure in Southeast Asia.” Pacific Affairs 92, no. 2 (June 1, 2019): 287–311. https://doi.org/10.5509/2019922287. 

Li, Luyuan, Pieter Uyttenhove, and Veerle Van Eetvelde. “Planning Green Infrastructure to Mitigate Urban Surface Water Flooding Risk – a Methodology to Identify Priority Areas Applied in the City of Ghent.” Landscape and Urban Planning 194 (February 2020): 103703. https://doi.org/10.1016/j.landurbplan.2019.103703. 

Mikovits, Christian, Wolfgang Rauch, and Manfred Kleidorfer. “Importance of Scenario Analysis in Urban Development for Urban Water Infrastructure Planning and Management.” Computers, Environment and Urban Systems 68 (March 2018): 9–16. https://doi.org/10.1016/j.compenvurbsys.2017.09.006. 

Wang, Yafei, Zhuobiao Ni, Mengmeng Hu, Shaoqing Chen, and Beicheng Xia. “A Practical Approach of Urban Green Infrastructure Planning to Mitigate Urban Overheating: A Case Study of Guangzhou.” Journal of Cleaner Production 287 (March 2021): 124995. https://doi.org/10.1016/j.jclepro.2020.124995. 

“2. ASEAN Transport Policy, Infrastructure Development and Trade Facilitation.” Urbanization in Southeast Asia, December 31, 2012, 81–114. https://doi.org/10.1355/9789814380041-007. 

Zhang, Silin, Buhao Zhang, Yi Zhao, Shun Zhang, and Zhichao Cao. “Urban Infrastructure Construction Planning: Urban Public Transport Line Formulation.” Buildings 14, no. 7 (July 3, 2024): 2031. https://doi.org/10.3390/buildings14072031. 

Sturdevant, Gwynn, A. Jonathan R. Godfrey, and Andrew Gelman. “Delivering Data Differently.” arXiv.org, April 14, 2022. https://arxiv.org/abs/2204.10854. 

[Back to the top](#addprojectTitle)
